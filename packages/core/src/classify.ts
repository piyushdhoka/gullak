// The category model, SemIf ("semantic if") style, as on openjev.com.
//
// The model writes the category *name*, constrained by a grammar to exactly one of our 14 categories,
// and we compute an honest confidence from its token probabilities: at every step, the chosen token's
// probability compared with the other tokens that would still spell a valid category.
// (Letter options were tried first; Qwen3 0.6B can't map letters to meanings reliably.)
//
// Model: Qwen3 0.6B (the smallest SemIf model), served by llama.cpp's llama-server. The fixed part of the
// prompt comes first so llama-server's prompt cache reuses it; only the payment at the end is new.

import { CATEGORIES, isCategory, type Category } from './categorize.ts';
import type { Direction } from './parse-sms.ts';

export interface ClassifyInput {
  payee: string | null;
  vpa: string | null;
  direction: Direction;
  text: string;
}

export interface ClassifyResult {
  category: string;
  /** 0–1: how sure the model was, among the valid category names only. */
  confidence: number;
}

/** What each category means, so a small model has something to go on. */
const OPTIONS: Record<Category, string> = {
  Food: 'restaurants, cafes, tea stalls, sweets, biryani, food delivery like Swiggy or Zomato',
  Groceries: 'supermarkets, kirana stores, milk, vegetables, quick commerce like Blinkit, Zepto, BigBasket',
  Shopping: 'online shopping, clothes, shoes, electronics, sports goods, Amazon, Flipkart, Myntra, Decathlon',
  Transport: 'cabs, autos, fuel, petrol pump, metro, parking, tolls, FASTag, Uber, Ola, Rapido',
  Travel: 'flights, trains, buses, hotels, IRCTC, MakeMyTrip, IndiGo',
  Bills: 'phone recharge, electricity, internet, gas, water, rent, insurance premium, loan EMI',
  Entertainment: 'movies, cinema, streaming, music, games, events, Netflix, Spotify, PVR, BookMyShow',
  Health: 'pharmacy, medical store, chemist, doctor, hospital, lab tests, gym, fitness',
  Investments: 'mutual funds, SIP, stocks, gold, Groww, Zerodha',
  Transfers: 'money sent to a person by name or phone number, or between my own accounts',
  Cash: 'ATM cash withdrawal',
  Income: 'salary, or money received from a person or company',
  Refund: 'refund, reversal or cashback of an earlier payment',
  Other: 'none of the above, or impossible to tell (for example a bare QR code ID)',
};

const PREFIX =
  '<|im_start|>system\n' +
  'You sort Indian bank payments into one category. Reply with the category name only.<|im_end|>\n' +
  '<|im_start|>user\nCategories:\n' +
  CATEGORIES.map((c) => `- ${c}: ${OPTIONS[c]}`).join('\n') +
  '\n\nPayment:\n';

/** The full prompt for one payment (Qwen3 chat format, thinking switched off). */
export function buildCategoryPrompt(input: ClassifyInput): string {
  const who = [input.payee, input.vpa && input.vpa !== input.payee ? `(${input.vpa})` : null].filter(Boolean).join(' ');
  const sms = input.text.replace(/\s+/g, ' ').trim().slice(0, 320);
  return (
    PREFIX +
    `${input.direction === 'debit' ? 'Money paid to' : 'Money received from'}: ${who || 'unknown'}\n` +
    `Bank SMS: ${sms}\n` +
    'Which category?<|im_end|>\n' +
    '<|im_start|>assistant\n<think>\n\n</think>\n\n'
  );
}

/** GBNF grammar: the answer must be exactly one category name. */
export const CATEGORY_GRAMMAR = `root ::= ${CATEGORIES.map((c) => `"${c}"`).join(' | ')}`;

/** Request body for llama-server's /completion endpoint. */
export function completionRequest(input: ClassifyInput) {
  return {
    prompt: buildCategoryPrompt(input),
    grammar: CATEGORY_GRAMMAR,
    n_predict: 8,
    n_probs: 20,
    temperature: 0,
    cache_prompt: true,
  };
}

/** One candidate token, as llama-server reports it (older and newer response shapes). */
export interface TokenProb {
  token?: string;
  tok_str?: string;
  logprob?: number;
  prob?: number;
}

interface Step extends TokenProb {
  top_logprobs?: TokenProb[];
  probs?: TokenProb[];
}

const tokenText = (t: TokenProb) => t.token ?? t.tok_str ?? '';
const tokenProb = (t: TokenProb) => (typeof t.prob === 'number' ? t.prob : typeof t.logprob === 'number' ? Math.exp(t.logprob) : 0);

/**
 * Reads a grammar-constrained answer. Confidence multiplies, for each generated token, its probability
 * divided by the probability of all candidates that would still spell some category (so tokens the
 * grammar ruled out don't count, and neither does probability mass the model put on other words).
 */
export function readAnswer(response: unknown): ClassifyResult | null {
  const r = response as { content?: string; completion_probabilities?: Step[] };
  const category = (r?.content ?? '').trim();
  if (!isCategory(category)) return null;
  let prefix = '';
  let confidence = 1;
  for (const step of r.completion_probabilities ?? []) {
    const chosen = tokenText(step);
    if (!chosen) continue;
    const candidates = step.top_logprobs ?? step.probs ?? [];
    let valid = 0;
    let chosenP = tokenProb(step);
    for (const c of candidates) {
      const text = tokenText(c);
      if (CATEGORIES.some((k) => k.startsWith(prefix + text) || (prefix + text).startsWith(k))) valid += tokenProb(c);
      if (text === chosen) chosenP = tokenProb(c);
    }
    if (valid > 0) confidence *= Math.min(1, chosenP / valid);
    prefix += chosen;
    if (prefix.trim() === category) break;
  }
  return { category, confidence };
}
