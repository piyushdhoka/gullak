// POST /functions/v1/ask   Authorization: Bearer <user JWT>
// Body: { "messages": [{ "role": "user" | "assistant", "content": "..." }, ...] }   (last 10 used)
// → { "answer": "...", "used": ["spending", ...] }
//
// Ask Gullak. Loads the caller's own data with their token (row-level security applies), then lets the AI
// model answer by calling the tools in packages/core/src/ask.ts. No raw SMS is loaded or sent.
//
// The provider is configured with three secrets (any OpenAI-compatible API):
//   AI_BASE_URL   e.g. https://router.huggingface.co/v1
//   AI_API_KEY
//   AI_MODEL      e.g. Qwen/Qwen3.5-4B
// Without them it answers 503 "not switched on yet".

import { createClient } from 'npm:@supabase/supabase-js@2';

import { ask, openAICompatible, type AskData } from '../../../packages/core/src/ask.ts';
import type { Jar, JarEntry } from '../../../packages/core/src/jars.ts';
import type { Budget } from '../../../packages/core/src/stats.ts';
import type { Transaction } from '../../../packages/core/src/types.ts';
import { CORS, json } from '../_shared/server.ts';

const TXN_COLUMNS =
  'id, occurred_at, amount, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, sms_id';

function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys?.default) return keys.default;
  } catch {
    // fall back
  }
  return Deno.env.get('SUPABASE_ANON_KEY')!;
}

interface Incoming {
  role: 'user' | 'assistant';
  content: string;
}

function readMessages(body: unknown): Incoming[] {
  const list = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(list)) return [];
  return list
    .filter((m): m is Incoming => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return json(401, { error: 'Sign in first' });

  const baseUrl = Deno.env.get('AI_BASE_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL');
  if (!baseUrl || !apiKey || !model) return json(503, { error: 'Ask Gullak isn’t switched on yet.' });

  const messages = readMessages(await req.json().catch(() => null));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json(400, { error: 'Ask a question' });

  // The caller's own rows only: their token + the public key, so row-level security does the filtering.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!who.user) return json(401, { error: 'Sign in first' });

  const since = new Date();
  since.setMonth(since.getMonth() - 13, 1);
  const [tx, budgets, jars, entries] = await Promise.all([
    db.from('transactions').select(TXN_COLUMNS).gte('occurred_at', since.toISOString()).order('occurred_at', { ascending: false }).limit(5000),
    db.from('budgets').select('category, monthly_limit'),
    db.from('jars').select('id, name, emoji, target, target_date, created_at').eq('archived', false),
    db.from('jar_entries').select('id, jar_id, amount, note, created_at'),
  ]);
  if (tx.error) return json(500, { error: 'Could not load your payments' });

  const data: AskData = {
    now: new Date(),
    transactions: (tx.data as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) })),
    // Tables that aren't there yet (older database) just mean "none".
    budgets: ((budgets.data ?? []) as Budget[]).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) })),
    jars: ((jars.data ?? []) as Jar[]).map((j) => ({ ...j, target: Number(j.target) })),
    jarEntries: ((entries.data ?? []) as JarEntry[]).map((e) => ({ ...e, amount: Number(e.amount) })),
  };

  try {
    return json(200, await ask(messages, data, openAICompatible({ baseUrl, apiKey, model })));
  } catch (err) {
    console.error('ask failed', err);
    return json(502, { error: 'Gullak’s AI is not answering right now. Try again in a minute.' });
  }
});
