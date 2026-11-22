// POST /functions/v1/ingest/<capture key>   (what the iOS Shortcut calls, via gullak.sparkstudio.co.in/ingest/<key>)
// POST /functions/v1/ingest with header x-capture-key, or Authorization: Bearer <user JWT> (the app's test button).
// Body: JSON { "text": "...", "received_at": "..." } or the raw SMS as text/plain.
// Deployed with JWT verification off: authentication is the capture key (or the user's own JWT).

import { processCapture, sha256Hex, type ClassifyResult, type IngestDeps } from '../_shared/ingest-core.ts';
import { admin, CORS, json, PUBLIC_URL, vapidKeys, webpush } from '../_shared/server.ts';

const MAX_BODY = 16 * 1024;

/** Keys are `cap_` + lowercase hex, so paste slips (capitals, spaces, quotes) are safe to drop. */
function normaliseKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function keyFromPath(url: string): string | null {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const i = parts.lastIndexOf('ingest');
  return i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1]) : null;
}

async function resolveUser(req: Request): Promise<string | null> {
  const rawKey = keyFromPath(req.url) ?? req.headers.get('x-capture-key');
  if (rawKey) {
    const key = normaliseKey(rawKey);
    const { data } = await admin.from('capture_keys').select('user_id').eq('key_hash', await sha256Hex(key)).maybeSingle();
    if (!data) {
      console.warn(`capture key rejected: ${key.length} chars ending …${key.slice(-4)}`);
      return null;
    }
    await admin.from('capture_keys').update({ last_used_at: new Date().toISOString() }).eq('user_id', data.user_id);
    return data.user_id as string;
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

async function readBody(req: Request): Promise<{ text: string; receivedAt: string | null }> {
  const raw = (await req.text()).slice(0, MAX_BODY);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        text: String(parsed.text ?? parsed.message ?? parsed.body ?? ''),
        receivedAt: parsed.received_at ? String(parsed.received_at) : null,
      };
    }
  } catch {
    // plain text body
  }
  return { text: raw, receivedAt: null };
}

const CLASSIFIER_URL = Deno.env.get('CLASSIFIER_URL');

const deps: IngestDeps = {
  async insertSms(row) {
    const { data, error } = await admin.from('sms_inbox').insert(row).select('id').single();
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
  classify: CLASSIFIER_URL
    ? async (input): Promise<ClassifyResult | null> => {
        const res = await fetch(CLASSIFIER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('CLASSIFIER_TOKEN') ?? ''}` },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return null;
        const body = await res.json();
        return typeof body?.category === 'string' && typeof body?.confidence === 'number'
          ? { category: body.category, confidence: body.confidence }
          : null;
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
  async notify(userId, payload) {
    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
    if (!subs?.length) return;
    const keys = await vapidKeys();
    webpush.setVapidDetails(PUBLIC_URL, keys.publicKey, keys.privateKey);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 3600, urgency: 'high' },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
          else console.error('push failed', code ?? err);
        }
      }),
    );
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const userId = await resolveUser(req);
  if (!userId) return json(401, { error: 'Missing or invalid capture key' });

  const { text, receivedAt } = await readBody(req);
  if (!text.trim()) return json(400, { error: 'Empty message' });

  try {
    const minConfidence = Number(Deno.env.get('CLASSIFIER_MIN_CONFIDENCE') ?? '') || undefined;
    return json(200, await processCapture(deps, { userId, text, receivedAt, minConfidence }));
  } catch (err) {
    console.error('ingest failed', err);
    return json(500, { error: 'Could not save this message' });
  }
});
