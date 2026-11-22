// POST /functions/v1/ask   Authorization: Bearer <user JWT>
// Body: { "messages": [{ "role": "user" | "assistant", "content": "...", "sig"?: "..." }, ...] }   (last 10 used)
// → { "answer": "...", "used": ["spending", ...], "sig": "..." }
//
// Guardrails (packages/core/src/guard.ts):
//   * rate limit per user (public.ai_allow: 6 a minute, 60 a day, plus a daily ceiling for everyone) → 429
//   * request body capped at 16 KB
//   * assistant turns are only trusted if they carry the signature this function returned with them,
//     so a client can't invent earlier Gullu replies to talk it into breaking its rules
//   * prompt-injection and off-topic questions are refused without calling the AI
//   * payee/merchant names are cleaned before the AI sees them; answers are checked before they're sent
//
// Gullu, the chatbot. Loads the caller's own data with their token (row-level security applies), then lets the AI
// model answer by calling the tools in packages/core/src/ask.ts. No raw SMS is loaded or sent.
//
// Provider: Gemini 3.5 Flash-Lite through Google's OpenAI-compatible endpoint, using the GEMINI_API_KEY secret.
// Any other OpenAI-compatible provider can replace it with AI_BASE_URL + AI_API_KEY + AI_MODEL.
// Without a key it answers 503 "not switched on yet".

import { checkQuestion, prepareHistory, signAnswer, verifyAnswer } from '../../../packages/core/src/guard.ts';
import { ask, GEMINI_CHAT_MODEL, GEMINI_OPENAI_URL, openAICompatible, type AskData } from '../../../packages/core/src/ask.ts';
import type { Jar, JarEntry } from '../../../packages/core/src/jars.ts';
import type { Budget } from '../../../packages/core/src/stats.ts';
import type { Transaction } from '../../../packages/core/src/types.ts';
import { checkRate, CORS, json, rateLimited, signingKey, userSession } from '../_shared/server.ts';

const TXN_COLUMNS =
  'id, occurred_at, amount, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, sms_id';

const MAX_BODY_BYTES = 16 * 1024;

function provider() {
  const custom = Deno.env.get('AI_API_KEY');
  if (custom) {
    const baseUrl = Deno.env.get('AI_BASE_URL');
    const model = Deno.env.get('AI_MODEL');
    return baseUrl && model ? { baseUrl, apiKey: custom, model } : null;
  }
  const gemini = Deno.env.get('GEMINI_API_KEY');
  return gemini ? { baseUrl: GEMINI_OPENAI_URL, apiKey: gemini, model: GEMINI_CHAT_MODEL } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const session = await userSession(req);
  if (!session) return json(401, { error: 'Sign in first' });
  const { db, userId } = session;

  const ai = provider();
  if (!ai) return json(503, { error: 'Gullu isn’t switched on yet.' });

  // Read the body with a size cap (Content-Length can be missing or wrong).
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { error: 'That message is too long.' });
  const text = await req.text().catch(() => '');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(413, { error: 'That message is too long.' });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  // Counted before anything else that costs money, including refused questions, so spam is limited too.
  const rate = await checkRate(db, 'ask');
  if (!rate.allowed) return rateLimited(rate);

  const key = signingKey();
  const messages = await prepareHistory((body as { messages?: unknown })?.messages, (content, sig) => verifyAnswer(key, userId, content, sig));
  if (!messages.length) return json(400, { error: 'Ask a question' });

  // Refuse injection / off-topic questions before loading anything or calling the AI.
  const check = checkQuestion(messages[messages.length - 1].content);
  if (!check.ok) {
    console.warn('gullu refused', { user: userId, reason: check.reason });
    return json(200, { answer: check.refusal, used: [], sig: await signAnswer(key, userId, check.refusal) });
  }

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
    budgets: ((budgets.data ?? []) as Budget[]).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) })),
    jars: ((jars.data ?? []) as Jar[]).map((j) => ({ ...j, target: Number(j.target) })),
    jarEntries: ((entries.data ?? []) as JarEntry[]).map((e) => ({ ...e, amount: Number(e.amount) })),
  };

  try {
    const result = await ask(messages, data, openAICompatible(ai));
    if (result.refused) console.warn('gullu refused', { user: userId, reason: result.refused });
    return json(200, { answer: result.answer, used: result.used, sig: await signAnswer(key, userId, result.answer) });
  } catch (err) {
    console.error('ask failed', err);
    return json(502, { error: 'Gullu isn’t answering right now. Try again in a minute.' });
  }
});
