// HTTP API (Hono). Everything except /api/auth/*, /api/health and /ingest needs a session token.

import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';

import {
  createSession,
  deleteSession,
  hashPassword,
  newId,
  RateLimiter,
  rotateCaptureKey,
  userForCaptureKey,
  userForToken,
  verifyPassword,
} from './auth.ts';
import { isCategory } from './core/categorize.ts';
import { processCapture, type ClassifyInput, type ClassifyResult, type IngestDeps } from './core/ingest-core.ts';
import { nowIso, type DB } from './db.ts';
import type { PushSender } from './push.ts';

export interface AppOptions {
  db: DB;
  push?: PushSender;
  vapidPublicKey?: string;
  classify?: (input: ClassifyInput) => Promise<ClassifyResult | null>;
  minConfidence?: number;
  /** Extra origins allowed to call the API from a browser (e.g. the Expo dev server). */
  allowedOrigins?: string[];
  /** Allow creating a second account. Off: only the first sign-up is accepted. */
  allowSignup?: boolean;
  /** iCloud link to the shared "Gullak Capture" Shortcut, shown in Setup. */
  shortcutUrl?: string;
}

type Env = { Variables: { userId: string; email: string; token: string } };

interface TxnRow {
  id: string;
  occurred_at: string;
  amount_paise: number;
  direction: string;
  payee: string | null;
  payee_key: string | null;
  merchant: string | null;
  vpa: string | null;
  category: string;
  category_source: string;
  bank: string | null;
  account: string | null;
  upi_ref: string | null;
  channel: string;
  source: string;
  note: string | null;
  hidden: number;
  sms_id: string | null;
}

const TXN_COLUMNS =
  'id, occurred_at, amount_paise, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, sms_id';

function toApiTxn(r: TxnRow) {
  const { amount_paise, hidden, ...rest } = r;
  return { ...rest, amount: amount_paise / 100, hidden: hidden === 1 };
}

const toPaise = (rupees: number) => Math.round(rupees * 100);

function clientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'local';
}

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const app = new Hono<Env>();
  const loginLimiter = new RateLimiter(10, 15 * 60_000);

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'same-origin');
  });

  if (opts.allowedOrigins?.length) {
    app.use(
      '/api/*',
      cors({ origin: opts.allowedOrigins, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'] }),
    );
  }

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const user = token ? userForToken(db, token) : null;
    if (!user || !token) return c.json({ error: 'Sign in required' }, 401);
    c.set('userId', user.id);
    c.set('email', user.email);
    c.set('token', token);
    await next();
  };

  // ---------- health / public config ----------
  app.get('/api/health', (c) => c.json({ ok: true }));
  // The shared "Gullak Capture" iCloud Shortcut link, if one has been published (SHORTCUT_URL).
  app.get('/api/config', (c) => c.json({ shortcutUrl: opts.shortcutUrl ?? null }));

  // ---------- auth ----------
  app.get('/api/auth/status', (c) => {
    const { n } = db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
    return c.json({ hasUser: n > 0, signupOpen: n === 0 || !!opts.allowSignup });
  });

  app.post('/api/auth/signup', async (c) => {
    const { email, password } = strings(await c.req.json().catch(() => ({})));
    const { n } = db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
    if (n > 0 && !opts.allowSignup) return c.json({ error: 'This server already has an owner. Sign in instead.' }, 403);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return c.json({ error: 'Enter a valid email.' }, 400);
    if (!password || password.length < 8) return c.json({ error: 'Use at least 8 characters for the password.' }, 400);
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim());
    if (exists) return c.json({ error: 'That email already has an account.' }, 409);
    const id = newId();
    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      email.trim(),
      await hashPassword(password),
      nowIso(),
    );
    const token = createSession(db, id, c.req.header('user-agent') ?? null);
    return c.json({ token, email: email.trim() }, 201);
  });

  app.post('/api/auth/login', async (c) => {
    if (!loginLimiter.allow(clientIp(c))) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const { email, password } = strings(await c.req.json().catch(() => ({})));
    const user = email
      ? (db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email.trim()) as
          | { id: string; email: string; password_hash: string }
          | undefined)
      : undefined;
    if (!user || !password || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ error: 'Wrong email or password.' }, 401);
    }
    const token = createSession(db, user.id, c.req.header('user-agent') ?? null);
    return c.json({ token, email: user.email });
  });

  app.post('/api/auth/logout', requireUser, (c) => {
    deleteSession(db, c.get('token'));
    return c.json({ ok: true });
  });

  app.get('/api/me', requireUser, (c) => c.json({ id: c.get('userId'), email: c.get('email') }));

  // ---------- transactions ----------
  app.get('/api/transactions', requireUser, (c) => {
    const since = c.req.query('since') ?? new Date(Date.now() - 400 * 86_400_000).toISOString();
    const rows = db
      .prepare(`SELECT ${TXN_COLUMNS} FROM transactions WHERE user_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 5000`)
      .all(c.get('userId'), since) as unknown as TxnRow[];
    return c.json(rows.map(toApiTxn));
  });

  app.patch('/api/transactions/:id', requireUser, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { note?: string | null; hidden?: boolean };
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if ('note' in body) {
      sets.push('note = ?');
      args.push(typeof body.note === 'string' ? body.note.slice(0, 500) || null : null);
    }
    if (typeof body.hidden === 'boolean') {
      sets.push('hidden = ?');
      args.push(body.hidden ? 1 : 0);
    }
    if (!sets.length) return c.json({ error: 'Nothing to change' }, 400);
    const r = db
      .prepare(`UPDATE transactions SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(...args, nowIso(), c.req.param('id'), c.get('userId'));
    if (!r.changes) return c.json({ error: 'Not found' }, 404);
    return c.json({ ok: true });
  });

  /** Set a category, remember it for the payee, optionally re-apply to that payee's past payments. */
  app.post('/api/transactions/:id/category', requireUser, async (c) => {
    const { category, applyToPayee } = (await c.req.json().catch(() => ({}))) as { category?: string; applyToPayee?: boolean };
    if (!isCategory(category)) return c.json({ error: 'Unknown category' }, 400);
    const userId = c.get('userId');
    const row = db.prepare('SELECT payee_key FROM transactions WHERE id = ? AND user_id = ?').get(c.req.param('id'), userId) as
      | { payee_key: string | null }
      | undefined;
    if (!row) return c.json({ error: 'Not found' }, 404);
    const now = nowIso();
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE transactions SET category = ?, category_source = 'user', updated_at = ? WHERE id = ? AND user_id = ?`).run(
        category,
        now,
        c.req.param('id'),
        userId,
      );
      let changed = 1;
      if (row.payee_key) {
        saveRule(db, userId, row.payee_key, category, now);
        if (applyToPayee) {
          changed = Number(
            db
              .prepare(`UPDATE transactions SET category = ?, category_source = 'user', updated_at = ? WHERE user_id = ? AND payee_key = ?`)
              .run(category, now, userId, row.payee_key).changes,
          );
        }
      }
      db.exec('COMMIT');
      return c.json({ ok: true, changed });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // ---------- review: payees nothing could categorise ----------
  app.get('/api/review', requireUser, (c) => {
    const rows = db
      .prepare(
        `SELECT COALESCE(payee_key, 'txn:' || id) AS key, MAX(merchant) AS merchant, MAX(payee) AS payee, MAX(vpa) AS vpa,
                COUNT(*) AS count, SUM(amount_paise) AS total_paise, MAX(occurred_at) AS last_at
         FROM transactions
         WHERE user_id = ? AND category_source = 'unknown' AND hidden = 0 AND direction = 'debit'
         GROUP BY key ORDER BY count DESC, last_at DESC LIMIT 200`,
      )
      .all(c.get('userId')) as { key: string; merchant: string | null; payee: string | null; vpa: string | null; count: number; total_paise: number; last_at: string }[];
    return c.json(rows.map(({ total_paise, ...r }) => ({ ...r, total: total_paise / 100 })));
  });

  app.post('/api/review', requireUser, async (c) => {
    const { key, category } = (await c.req.json().catch(() => ({}))) as { key?: string; category?: string };
    if (!key || !isCategory(category)) return c.json({ error: 'key and a valid category are required' }, 400);
    const userId = c.get('userId');
    const now = nowIso();
    let changed: number;
    if (key.startsWith('txn:')) {
      changed = Number(
        db
          .prepare(`UPDATE transactions SET category = ?, category_source = 'user', updated_at = ? WHERE id = ? AND user_id = ?`)
          .run(category, now, key.slice(4), userId).changes,
      );
    } else {
      saveRule(db, userId, key, category, now);
      changed = Number(
        db
          .prepare(`UPDATE transactions SET category = ?, category_source = 'user', updated_at = ? WHERE user_id = ? AND payee_key = ?`)
          .run(category, now, userId, key).changes,
      );
    }
    return c.json({ ok: true, changed });
  });

  // ---------- SMS inbox ----------
  app.get('/api/inbox', requireUser, (c) => {
    const rows = db
      .prepare(
        `SELECT id, body, received_at, status, reason FROM sms_inbox WHERE user_id = ? AND status = 'unrecognised' ORDER BY received_at DESC LIMIT 100`,
      )
      .all(c.get('userId'));
    return c.json(rows);
  });

  app.get('/api/sms/:id', requireUser, (c) => {
    const row = db.prepare('SELECT id, body, received_at, status, reason FROM sms_inbox WHERE id = ? AND user_id = ?').get(
      c.req.param('id'),
      c.get('userId'),
    );
    return row ? c.json(row) : c.json({ error: 'Not found' }, 404);
  });

  app.post('/api/inbox/:id/dismiss', requireUser, (c) => {
    db.prepare(`UPDATE sms_inbox SET status = 'dismissed' WHERE id = ? AND user_id = ?`).run(c.req.param('id'), c.get('userId'));
    return c.json({ ok: true });
  });

  // ---------- capture key ----------
  app.get('/api/capture-key', requireUser, (c) => {
    const row = db.prepare('SELECT key_hint, created_at, last_used_at FROM capture_keys WHERE user_id = ?').get(c.get('userId'));
    return c.json(row ?? null);
  });

  app.post('/api/capture-key', requireUser, (c) => c.json({ key: rotateCaptureKey(db, c.get('userId')) }));

  // ---------- push ----------
  app.get('/api/push/public-key', (c) => c.json({ publicKey: opts.vapidPublicKey ?? null }));

  app.post('/api/push/subscribe', requireUser, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!body.endpoint?.startsWith('https://') || !body.keys?.p256dh || !body.keys?.auth) {
      return c.json({ error: 'Invalid subscription' }, 400);
    }
    db.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    ).run(newId(), c.get('userId'), body.endpoint, body.keys.p256dh, body.keys.auth, c.req.header('user-agent') ?? null, nowIso());
    return c.json({ ok: true });
  });

  // ---------- capture (iOS Shortcut) ----------
  const ingestDeps = makeIngestDeps(opts);
  const ingest = async (c: Context<Env>) => {
    // The key can be a header or part of the address (/ingest/<key>), so the Shortcut needs one paste.
    // If both are present (an old header left in the Shortcut), the address wins.
    const key = (c.req.param('key') ?? c.req.header('x-capture-key'))?.trim();
    let userId: string | null = null;
    if (key) userId = userForCaptureKey(db, key);
    else {
      const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
      userId = token ? (userForToken(db, token)?.id ?? null) : null;
    }
    if (!userId) return c.json({ error: 'Missing or invalid capture key' }, 401);

    const raw = await c.req.text();
    let text = raw;
    let receivedAt: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        text = String(parsed.text ?? parsed.message ?? parsed.body ?? '');
        receivedAt = parsed.received_at ? String(parsed.received_at) : null;
      }
    } catch {
      // plain-text body
    }
    if (!text.trim()) return c.json({ error: 'Empty message' }, 400);
    const result = await processCapture(ingestDeps, { userId, text, receivedAt, minConfidence: opts.minConfidence });
    return c.json(result);
  };
  const limit = bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Message too large' }, 413) });
  app.post('/ingest', limit, ingest);
  app.post('/ingest/:key', limit, ingest);
  app.post('/api/ingest', limit, ingest);

  return app;
}

/** Reads email/password from a request body, ignoring anything that isn't a string. */
function strings(body: unknown): { email?: string; password?: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    email: typeof b.email === 'string' ? b.email : undefined,
    password: typeof b.password === 'string' ? b.password : undefined,
  };
}

function saveRule(db: DB, userId: string, payeeKey: string, category: string, now: string) {
  db.prepare(
    `INSERT INTO payee_rules (user_id, payee_key, category, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, payee_key) DO UPDATE SET category = excluded.category, updated_at = excluded.updated_at`,
  ).run(userId, payeeKey, category, now);
}

function makeIngestDeps(opts: AppOptions): IngestDeps {
  const { db } = opts;
  return {
    async insertSms(row) {
      const id = newId();
      db.prepare('INSERT INTO sms_inbox (id, user_id, body, received_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        row.user_id,
        row.body,
        row.received_at,
        nowIso(),
      );
      return id;
    },
    async updateSms(id, patch) {
      db.prepare('UPDATE sms_inbox SET status = ?, reason = ? WHERE id = ?').run(patch.status, patch.reason, id);
    },
    async getPayeeRule(userId, payeeKey) {
      const row = db.prepare('SELECT category FROM payee_rules WHERE user_id = ? AND payee_key = ?').get(userId, payeeKey) as
        | { category: string }
        | undefined;
      return row?.category ?? null;
    },
    classify: opts.classify,
    async insertTransaction(t) {
      const id = newId();
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO transactions (id, user_id, sms_id, occurred_at, amount_paise, direction, payee, payee_key, merchant, vpa,
             category, category_source, bank, account, upi_ref, channel, source, dedupe_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sms', ?, ?, ?)
           ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        )
        .run(
          id,
          t.user_id,
          t.sms_id,
          t.occurred_at,
          toPaise(t.amount),
          t.direction,
          t.payee,
          t.payee_key,
          t.merchant,
          t.vpa,
          t.category,
          t.category_source,
          t.bank,
          t.account,
          t.upi_ref,
          t.channel,
          t.dedupe_key,
          now,
          now,
        );
      return r.changes ? id : null;
    },
    async notify(userId, payload) {
      if (!opts.push) return;
      const subs = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId) as {
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }[];
      await Promise.all(
        subs.map(async (s) => {
          try {
            await opts.push!(s, payload);
          } catch (err) {
            const code = (err as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
            else console.error('push failed', code ?? err);
          }
        }),
      );
    },
  };
}
