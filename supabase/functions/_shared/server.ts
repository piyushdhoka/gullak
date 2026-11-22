// Shared server-side helpers for Gullak's Edge Functions: admin client, CORS, VAPID keys, push.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

import type { PushPayload } from '../../../packages/core/src/ingest-core.ts';

export const PUBLIC_URL = 'https://gullak.sparkstudio.co.in';

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (keys?.default) return keys.default;
  } catch {
    // fall back to the legacy key
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

/** Bypasses row-level security; only ever used inside Edge Functions. */
export const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
  auth: { persistSession: false },
});

function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys?.default) return keys.default;
  } catch {
    // fall back to the legacy key
  }
  return Deno.env.get('SUPABASE_ANON_KEY')!;
}

/**
 * A client that acts as the caller (their token + the public key), so row-level security limits it to
 * their own rows, plus the caller's user id. Returns null when the token is missing or invalid.
 */
export async function userSession(req: Request): Promise<{ db: SupabaseClient; userId: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  return data.user ? { db, userId: data.user.id } : null;
}

/** Same as userSession, for callers that only need the client. */
export async function userClient(req: Request): Promise<SupabaseClient | null> {
  return (await userSession(req))?.db ?? null;
}

/** Key for signing Gullu's answers. GULLU_SIGNING_KEY if set, otherwise the project's secret key. */
export function signingKey(): string {
  return Deno.env.get('GULLU_SIGNING_KEY') || secretKey();
}

export interface RateResult {
  allowed: boolean;
  reason: 'minute' | 'day' | 'busy' | 'error' | null;
  retry_after: number;
}

/**
 * Counts one use of an AI feature against the caller's limits (public.ai_allow).
 * Fails closed: if the check itself fails, the AI call is refused, so an outage can't turn into an unlimited bill.
 */
export async function checkRate(db: SupabaseClient, kind: 'ask' | 'why'): Promise<RateResult> {
  const { data, error } = await db.rpc('ai_allow', { p_kind: kind });
  if (error || !data) {
    console.error('rate check failed', error);
    return { allowed: false, reason: 'error', retry_after: 60 };
  }
  return data as RateResult;
}

/** A 429 with a Retry-After header and a message people can read. */
export function rateLimited(rate: RateResult, extra: Record<string, unknown> = {}) {
  const error =
    rate.reason === 'day'
      ? 'You’ve asked Gullu a lot today. Try again tomorrow.'
      : rate.reason === 'busy'
        ? 'Gullu is very busy right now. Try again in a while.'
        : rate.reason === 'error'
          ? 'Gullu isn’t answering right now. Try again in a minute.'
          : `Slow down a little. Try again in ${rate.retry_after} seconds.`;
  return new Response(JSON.stringify({ error, retry_after: rate.retry_after, ...extra }), {
    status: rate.reason === 'error' ? 503 : 429,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rate.retry_after) },
  });
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-capture-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'retry-after',
};

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cached: VapidKeys | null = null;

/** VAPID keys live in public.app_secrets (service-role only). Generated once, on first use. */
export async function vapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  const { data } = await admin.from('app_secrets').select('value').eq('name', 'vapid').maybeSingle();
  if (data?.value) return (cached = JSON.parse(data.value) as VapidKeys);
  const fresh = webpush.generateVAPIDKeys();
  await admin.from('app_secrets').upsert({ name: 'vapid', value: JSON.stringify(fresh) }, { onConflict: 'name', ignoreDuplicates: true });
  // Re-read so two first requests racing each other end up with the same keys.
  const { data: again } = await admin.from('app_secrets').select('value').eq('name', 'vapid').single();
  return (cached = JSON.parse(again!.value) as VapidKeys);
}

interface Device {
  id: string;
  platform: 'web' | 'android' | 'ios';
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  expo_token: string | null;
}

/**
 * Sends one notification to every device the user has registered:
 * Web Push for the iPhone PWA, Expo push (FCM underneath) for the Android app.
 * Devices that the push service says are gone are removed.
 */
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  const { data } = await admin.from('devices').select('id, platform, endpoint, p256dh, auth, expo_token').eq('user_id', userId);
  const devices = (data ?? []) as Device[];
  if (!devices.length) return;

  const web = devices.filter((d) => d.endpoint && d.p256dh && d.auth);
  const expo = devices.filter((d) => d.expo_token);
  const gone: string[] = [];

  if (web.length) {
    const keys = await vapidKeys();
    webpush.setVapidDetails(PUBLIC_URL, keys.publicKey, keys.privateKey);
    await Promise.all(
      web.map(async (d) => {
        try {
          await webpush.sendNotification(
            { endpoint: d.endpoint!, keys: { p256dh: d.p256dh!, auth: d.auth! } },
            JSON.stringify(payload),
            { TTL: 3600, urgency: 'high' },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(d.id);
          else console.error('web push failed', code ?? err);
        }
      }),
    );
  }

  if (expo.length) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          expo.map((d) => ({
            to: d.expo_token,
            title: payload.title,
            body: payload.body,
            data: { url: payload.url },
            sound: 'default',
            priority: 'high',
            channelId: 'payments',
          })),
        ),
      });
      const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      body.data?.forEach((ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') gone.push(expo[i].id);
      });
    } catch (err) {
      console.error('expo push failed', err);
    }
  }

  if (gone.length) await admin.from('devices').delete().in('id', gone);
}

export { webpush };
