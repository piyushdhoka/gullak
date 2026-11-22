// POST /functions/v1/why   Authorization: Bearer <user JWT>
// Body: { "transaction_id": "..." }
// → { "odds": [{ "category": "Health", "p": 0.86 }, ...] }   or   { "odds": null } when the AI can't help
//
// The odds behind "Why this category?": Gemini Decision 1 rates every category for this payee.
// The payment is read with the caller's own token (row-level security), and only the payee name,
// UPI ID and direction are sent to Google. QR codes and payment IDs are not sent (nothing to judge).
// Rate limited per user, like the chatbot.

import { isOpaquePayee } from '../../../packages/core/src/categorize.ts';
import { categoryOdds } from '../../../packages/core/src/decision.ts';
import { checkRate, CORS, json, rateLimited, userClient } from '../_shared/server.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const db = await userClient(req);
  if (!db) return json(401, { error: 'Sign in first' });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json(200, { odds: null });

  const body = (await req.json().catch(() => null)) as { transaction_id?: unknown } | null;
  const id = typeof body?.transaction_id === 'string' ? body.transaction_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: 'transaction_id required' });

  const { data: t } = await db.from('transactions').select('payee, vpa, direction, channel').eq('id', id).maybeSingle();
  if (!t) return json(404, { error: 'Payment not found' });
  if (t.channel === 'atm' || t.channel === 'cash' || isOpaquePayee(t.payee, t.vpa)) return json(200, { odds: null });

  // Only calls that reach the AI count (20 a minute, 200 a day per user; see public.ai_allow).
  const rate = await checkRate(db, 'why');
  if (!rate.allowed) return rateLimited(rate, { odds: null });

  try {
    const odds = await categoryOdds({ payee: t.payee, vpa: t.vpa, direction: t.direction }, { apiKey });
    return json(200, { odds: odds.map((o) => ({ category: o.category, p: Math.round(o.p * 1000) / 1000 })) });
  } catch (err) {
    console.error('why failed', err);
    return json(200, { odds: null });
  }
});
