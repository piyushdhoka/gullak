// Gullak's capture endpoint. Every bank SMS, from either platform, comes through here.
//
//   iPhone (Shortcuts automation)  POST /functions/v1/ingest/<capture key>
//                                  (via https://gullak.sparkstudio.co.in/ingest/<capture key>)
//                                  body: { "text": "...", "received_at": "..." }  or the raw SMS as text
//   Android app                    POST /functions/v1/ingest   Authorization: Bearer <user JWT>
//                                  body: { "messages": [{ "text", "received_at" }, ...], "backfill": false }
//   App "Send test SMS" button     POST /functions/v1/ingest   Authorization: Bearer <user JWT>
//                                  body: { "text": "...", "test": true }
//
// Deployed with JWT verification off: authentication is the capture key or the user's own JWT.
// Parsing and categorising live in packages/core (shared with the Android app and the tests).
// Categories come only from the owner's saved choices and the AI model; nothing else guesses.

import { candidatesFrom, completionRequest, pickCategory } from '../../../packages/core/src/classify.ts';
import { processCapture, sha256Hex, type CaptureResult, type ClassifyResult, type IngestDeps } from '../../../packages/core/src/ingest-core.ts';
import { admin, CORS, json, notifyUser } from '../_shared/server.ts';

const MAX_BODY = 512 * 1024;
const MAX_BATCH = 500;

type Origin = 'shortcut' | 'android' | 'test';

interface Message {
  text: string;
  receivedAt: string | null;
}

/** Keys are `cap_` + lowercase hex, so paste slips (capitals, spaces, quotes) are safe to drop. */
function normaliseKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function keyFromPath(url: string): string | null {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const i = parts.lastIndexOf('ingest');
  return i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1]) : null;
}

/** Who is sending: a capture key (iPhone Shortcut) or a signed-in user's token (apps). */
async function resolveUser(req: Request): Promise<{ userId: string; via: 'key' | 'token' } | null> {
  const rawKey = keyFromPath(req.url) ?? req.headers.get('x-capture-key');
  if (rawKey) {
    const key = normaliseKey(rawKey);
    const { data } = await admin.from('capture_keys').select('user_id').eq('key_hash', await sha256Hex(key)).maybeSingle();
    if (!data) {
      console.warn(`capture key rejected: ${key.length} chars ending …${key.slice(-4)}`);
      return null;
    }
    await admin.from('capture_keys').update({ last_used_at: new Date().toISOString() }).eq('user_id', data.user_id);
    return { userId: data.user_id as string, via: 'key' };
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    const { data } = await admin.auth.getUser(token);
    return data.user ? { userId: data.user.id, via: 'token' } : null;
  }
  return null;
}

function toMessage(v: unknown): Message | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const text = o.text ?? o.message ?? o.body;
  if (typeof text !== 'string' || !text.trim()) return null;
  const at = o.received_at ?? o.receivedAt;
  return { text, receivedAt: typeof at === 'string' || typeof at === 'number' ? String(at) : null };
}

async function readBody(req: Request): Promise<{ messages: Message[]; batch: boolean; backfill: boolean; test: boolean }> {
  const raw = (await req.text()).slice(0, MAX_BODY);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.messages)) {
      return {
        messages: parsed.messages.slice(0, MAX_BATCH).map(toMessage).filter((m: Message | null): m is Message => !!m),
        batch: true,
        backfill: parsed.backfill === true,
        test: false,
      };
    }
    const one = toMessage(parsed);
    return { messages: one ? [one] : [], batch: false, backfill: false, test: parsed?.test === true };
  } catch {
    // plain text body: the SMS itself
    return { messages: raw.trim() ? [{ text: raw, receivedAt: null }] : [], batch: false, backfill: false, test: false };
  }
}

// e.g. https://gullak.sparkstudio.co.in/llm (Caddy → llama-server on the EC2 box). Unset = no model: all to Review.
const CLASSIFIER_URL = Deno.env.get('CLASSIFIER_URL')?.replace(/\/$/, '');
// The model is the only classifier, so give it time; on a timeout the payment still saves and goes to Review.
const CLASSIFIER_TIMEOUT_MS = Number(Deno.env.get('CLASSIFIER_TIMEOUT_MS') ?? '') || 8000;

function makeDeps(origin: Origin, quiet: boolean): IngestDeps {
  return {
    async insertSms(row) {
      const { data, error } = await admin.from('sms_inbox').insert({ ...row, origin }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async updateSms(id, patch) {
      const { error } = await admin.from('sms_inbox').update(patch).eq('id', id);
      if (error) throw error;
    },
    async getPayeeRule(userId, payeeKey) {
      const { data } = await admin
        .from('payee_rules')
        .select('category')
        .eq('user_id', userId)
        .eq('payee_key', payeeKey)
        .maybeSingle();
      return data?.category ?? null;
    },
    // The category model: Qwen3 0.6B on llama-server, scored SemIf-style (see packages/core/src/classify.ts).
    classify: CLASSIFIER_URL
      ? async (input): Promise<ClassifyResult | null> => {
          const res = await fetch(`${CLASSIFIER_URL}/completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('CLASSIFIER_TOKEN') ?? ''}` },
            body: JSON.stringify(completionRequest(input)),
            signal: AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS),
          });
          if (!res.ok) {
            console.error('classifier answered', res.status);
            return null;
          }
          return pickCategory(candidatesFrom(await res.json()));
        }
      : undefined,
    async insertTransaction(row) {
      const { data, error } = await admin
        .from('transactions')
        .upsert(row, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
    // Imports of old messages stay silent; one summary notification goes out afterwards.
    notify: quiet ? async () => {} : notifyUser,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const who = await resolveUser(req);
  if (!who) return json(401, { error: 'Missing or invalid capture key' });

  const { messages, batch, backfill, test } = await readBody(req);
  if (!messages.length) return json(400, { error: 'Empty message' });

  const origin: Origin = who.via === 'key' ? 'shortcut' : test ? 'test' : 'android';
  const deps = makeDeps(origin, backfill);
  const minConfidence = Number(Deno.env.get('CLASSIFIER_MIN_CONFIDENCE') ?? '') || undefined;

  try {
    if (!batch) {
      const [m] = messages;
      return json(200, await processCapture(deps, { userId: who.userId, text: m.text, receivedAt: m.receivedAt, minConfidence }));
    }

    // Old messages (backfill) keep their own dates; live ones must be recent, as on the iPhone path.
    const results: CaptureResult[] = [];
    for (const m of messages) {
      const receivedAt = backfill && m.receivedAt ? backfillDate(m.receivedAt) : m.receivedAt;
      const now = backfill && receivedAt ? new Date(receivedAt) : undefined;
      try {
        results.push(await processCapture(deps, { userId: who.userId, text: m.text, receivedAt, now, minConfidence }));
      } catch (err) {
        console.error('batch item failed', err);
        results.push({ status: 'unrecognised', reason: 'could not save' });
      }
    }
    const saved = results.filter((r) => r.status === 'saved').length;
    if (backfill && saved > 0) {
      await notifyUser(who.userId, {
        title: `Imported ${saved} payment${saved === 1 ? '' : 's'}`,
        body: 'Your past bank SMS are in Gullak. Tap to review new payees.',
        url: '/review',
        tag: 'backfill',
      }).catch(() => {});
    }
    return json(200, {
      saved,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      ignored: results.filter((r) => r.status === 'ignored').length,
      unrecognised: results.filter((r) => r.status === 'unrecognised').length,
      results,
    });
  } catch (err) {
    console.error('ingest failed', err);
    return json(500, { error: 'Could not save this message' });
  }
});

/** Imported SMS may be up to 2 years old; anything else falls back to "now". */
function backfillDate(value: string): string | null {
  const d = new Date(/^\d+$/.test(value) ? Number(value) : value);
  const t = d.getTime();
  if (Number.isNaN(t) || t > Date.now() + 5 * 60_000 || t < Date.now() - 2 * 365 * 86_400_000) return null;
  return d.toISOString();
}
