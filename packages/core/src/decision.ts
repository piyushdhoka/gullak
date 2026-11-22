// Gemini Decision 1: picks a category for a payee and says how likely each category is.
// Used (1) at capture time, only for readable payees the hand-built rules can't place, and
// (2) for the odds on "Why this category?". Only the payee name, UPI ID and direction are sent:
// never the SMS text, account numbers or balances.

import { CATEGORIES, isCategory, isOpaquePayee, type Category } from './categorize.ts';
import type { Direction } from './parse-sms.ts';
import type { ClassifyInput, ClassifyResult } from './ingest-core.ts';

export const DECISION_URL = 'https://generativelanguage.googleapis.com/v1beta/decisions';
export const DECISION_MODEL = 'gemini-decision-1';

/** What each category means, for the model. */
const CRITERIA: Record<Category, string> = {
  Food: 'Restaurants, cafes, tea stalls, sweet shops, bakeries, food delivery',
  Groceries: 'Kirana, supermarkets, dairy, vegetables, daily household needs',
  Shopping: 'Clothes, shoes, electronics, mobiles, gifts, furniture, online shopping',
  Transport: 'Fuel, cabs, autos, metro, parking, tolls, vehicle repair',
  Travel: 'Flights, trains, buses between cities, hotels, travel agents',
  Bills: 'Electricity, water, gas, phone, internet, DTH, rent, recharges',
  Entertainment: 'Movies, streaming, games, events',
  Health: 'Medicines, chemists, doctors, hospitals, labs, gyms',
  Investments: 'Mutual funds, stocks, SIPs, brokers',
  Transfers: 'Money sent to a person (friend, family), not a business',
  Cash: 'Cash withdrawal',
  Income: 'Salary or money received for work',
  Refund: 'Money returned for an earlier purchase',
  Other: 'Anything else, or impossible to tell from the name',
};

/** Money going out can't be income or a refund; money coming in is rarely a shop category. */
function optionsFor(direction: Direction): Category[] {
  return direction === 'credit'
    ? ['Income', 'Refund', 'Transfers', 'Investments', 'Cash', 'Other']
    : CATEGORIES.filter((c) => c !== 'Income' && c !== 'Refund' && c !== 'Cash');
}

/** The only text the model sees. */
export function decisionInput(input: { payee: string | null; vpa: string | null; direction: Direction }): string {
  return [
    'An Indian bank SMS about a payment.',
    `Paid ${input.direction === 'debit' ? 'to' : 'by'}: ${input.payee ?? 'unknown'}`,
    input.vpa ? `UPI ID: ${input.vpa}` : null,
    input.direction === 'debit' ? 'Money went out of the account.' : 'Money came into the account.',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface CategoryOdds {
  category: Category;
  /** 0–1 */
  p: number;
}

export interface DecisionOptions {
  apiKey: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/** Calls Decision 1 and returns every allowed category with its probability, most likely first. */
export async function categoryOdds(
  input: { payee: string | null; vpa: string | null; direction: Direction },
  opts: DecisionOptions,
): Promise<CategoryOdds[]> {
  const options = optionsFor(input.direction);
  const doFetch = opts.fetchFn ?? fetch;
  const res = await doFetch(DECISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify({
      model: DECISION_MODEL,
      input: decisionInput(input),
      questions: {
        category: {
          type: 'choice',
          instructions: 'What did this payment most likely pay for? Judge from the name and UPI ID.',
          criteria: Object.fromEntries(options.map((c) => [c, CRITERIA[c]])),
        },
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
  });
  if (!res.ok) throw new Error(`Decision API answered ${res.status}`);
  const body = (await res.json()) as { answers?: { category?: { probabilities?: Record<string, number> } } };
  const probs = body.answers?.category?.probabilities;
  if (!probs) throw new Error('Decision API sent no answer');
  return Object.entries(probs)
    .filter((e): e is [Category, number] => isCategory(e[0]) && typeof e[1] === 'number')
    .map(([category, p]) => ({ category, p }))
    .sort((a, b) => b.p - a.p);
}

/** A classifier for processCapture: the top category and its probability. Never asked about QR codes / IDs. */
export function decisionClassifier(opts: DecisionOptions): (input: ClassifyInput) => Promise<ClassifyResult | null> {
  return async (input) => {
    if (isOpaquePayee(input.payee, input.vpa)) return null;
    const [top] = await categoryOdds(input, opts);
    return top ? { category: top.category, confidence: top.p } : null;
  };
}
