// Shared server-side helpers for Gullak's Edge Functions: admin client, CORS, VAPID keys.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-capture-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

export { webpush };
