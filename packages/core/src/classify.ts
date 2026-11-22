// The category model, SemIf ("semantic if") style, as on openjev.com:
// the model sees the payment and a lettered list of categories, and we read the probability it gives
// each letter for its next token. No text generation, no parsing of free-form answers: one forward pass,
// and an honest confidence number.
//
// Model: Qwen3 0.6B (the smallest SemIf model), served by llama.cpp's llama-server. The fixed part of the
// prompt comes first so llama-server's prompt cache reuses it; only the payment at the end is new.

import { CATEGORIES, type Category } from './categorize.ts';
import type { Direction } from './parse-sms.ts';

export interface ClassifyInput {
  payee: string | null;
  vpa: string | null;
  direction: Direction;
  text: string;
}

export interface ClassifyResult {
  category: string;
  /** 0–1, the model's probability for this category's letter. */
  confidence: number;
}

/** What each option means, so a small model has something to go on. Order = letters A, B, C… */
const OPTIONS: Record<Category, string> = {
  Food: 'restaurants, cafes, tea stalls, sweets, food delivery like Swiggy or Zomato',
  Groceries: 'supermarkets, kirana stores, milk, vegetables, quick commerce like Blinkit, Zepto, BigBasket',
  Shopping: 'online shopping, clothes, electronics, home goods, Amazon, Flipkart, Myntra',
  Transport: 'cabs, autos, fuel, metro, parking, tolls, FASTag, Uber, Ola, Rapido',
  Travel: 'flights, trains, buses, hotels, IRCTC, MakeMyTrip, IndiGo',
  Bills: 'phone recharge, electricity, internet, gas, water, rent, insurance premium, loan EMI',
  Entertainment: 'movies, streaming, music, games, events, Netflix, Spotify, BookMyShow',
  Health: 'pharmacy, medical store, doctor, hospital, lab tests, gym',
  Investments: 'mutual funds, SIP, stocks, gold, Groww, Zerodha',
  Transfers: 'money sent to a person, or between my own accounts',
  Cash: 'ATM cash withdrawal',
  Income: 'salary or money received from someone',
  Refund: 'refund, reversal or cashback of an earlier payment',
  Other: 'none of the above, or impossible to tell',
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letter → category, e.g. A → Food. */
export const OPTION_LETTERS: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c, i) => [LETTERS[i], c]));

const PREFIX =
  '<|im_start|>system\n' +
  'You sort Indian bank payments into one category. Reply with the single letter of the best category.<|im_end|>\n' +
  '<|im_start|>user\nCategories:\n' +
  CATEGORIES.map((c, i) => `${LETTERS[i]}) ${c}: ${OPTIONS[c]}`).join('\n') +
  '\n\nPayment:\n';

/** The full prompt for one payment (Qwen3 chat format, thinking switched off). */
export function buildCategoryPrompt(input: ClassifyInput): string {
  const who = [input.payee, input.vpa && input.vpa !== input.payee ? `(${input.vpa})` : null].filter(Boolean).join(' ');
  const sms = input.text.replace(/\s+/g, ' ').trim().slice(0, 320);
  return (
    PREFIX +
    `${input.direction === 'debit' ? 'Money paid to' : 'Money received from'}: ${who || 'unknown'}\n` +
    `Bank SMS: ${sms}\n` +
    'Which category? Reply with one letter.<|im_end|>\n' +
    '<|im_start|>assistant\n<think>\n\n</think>\n\n'
  );
}

/** One candidate next token, as llama-server reports it (older and newer response shapes). */
export interface TokenProb {
  token?: string;
  tok_str?: string;
  logprob?: number;
  prob?: number;
}

/**
 * Picks the category from the model's next-token probabilities. Tokens that aren't an option letter
 * are ignored; the same letter in different spellings (" A", "A") is added up.
 */
export function pickCategory(candidates: TokenProb[]): ClassifyResult | null {
  const mass = new Map<Category, number>();
  for (const c of candidates) {
    const letter = (c.token ?? c.tok_str ?? '').trim().replace(/[).:]$/, '').toUpperCase();
    const category = OPTION_LETTERS[letter];
    if (!category || letter.length !== 1) continue;
    const p = typeof c.prob === 'number' ? c.prob : typeof c.logprob === 'number' ? Math.exp(c.logprob) : 0;
    mass.set(category, (mass.get(category) ?? 0) + p);
  }
  let best: ClassifyResult | null = null;
  for (const [category, p] of mass) if (!best || p > best.confidence) best = { category, confidence: Math.min(1, p) };
  return best;
}

/** Request body for llama-server's /completion endpoint. */
export function completionRequest(input: ClassifyInput) {
  return {
    prompt: buildCategoryPrompt(input),
    n_predict: 1,
    n_probs: 20,
    temperature: 0,
    cache_prompt: true,
  };
}

/** Reads the first token's candidates out of a llama-server /completion response. */
export function candidatesFrom(response: unknown): TokenProb[] {
  const first = (response as { completion_probabilities?: unknown[] })?.completion_probabilities?.[0] as
    | { top_logprobs?: TokenProb[]; probs?: TokenProb[] }
    | undefined;
  return first?.top_logprobs ?? first?.probs ?? [];
}
