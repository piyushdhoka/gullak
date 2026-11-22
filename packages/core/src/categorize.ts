// Categories, display names, and the only two ways a payment gets a category:
//   1. the owner's own choice for that payee (a payee rule), or
//   2. the AI model (see classify.ts), when it is confident enough.
// There are no hand-written merchant lists or keyword rules: anything the model isn't sure about goes
// to Review, where one tap teaches Gullak that payee for good.

import type { Channel, Direction } from './parse-sms.ts';

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Shopping',
  'Transport',
  'Travel',
  'Bills',
  'Entertainment',
  'Health',
  'Investments',
  'Transfers',
  'Cash',
  'Income',
  'Refund',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Where a category came from:
 * - `user`: the owner picked it (directly or via a saved payee rule)
 * - `model`: the AI model, above its confidence threshold
 * - `unknown`: not decided yet; shown in Review for one tap
 */
export type CategorySource = 'user' | 'model' | 'unknown';

// Payment-gateway / QR identifiers: shown as-is rather than "prettified".
const OPAQUE_HINT =
  /^(paytmqr|paytm-?\d|bharatpe|q\d{5,}|ibkpos|gpay-?\d|upiqr|mab\.|yespay|razorpay|rzp|cf\.|cashfree|payu|billdesk|phonepe|ppe|ezetap|pinelabs|mswipe|vyapar|stq|bqr|bpqr|sbiqr|hdfcqr|merchant)/i;

/** True when the payee is just an ID (QR code, gateway handle, mostly digits) rather than a name. */
export function isOpaquePayee(payee: string | null, vpa: string | null): boolean {
  const name = (payee ?? vpa?.split('@')[0] ?? '').trim();
  if (!name) return true;
  const local = (vpa?.split('@')[0] ?? name).toLowerCase();
  if (OPAQUE_HINT.test(local) || OPAQUE_HINT.test(name)) return true;
  const letters = name.replace(/[^a-z]/gi, '');
  const digits = name.replace(/\D/g, '');
  if (!/[a-z]{3,}/i.test(name)) return true;
  return digits.length >= 4 && digits.length >= letters.length;
}

/** "SHREE GANESH ENTERPRISES" → "Shree Ganesh Enterprises", "rahul.k" → "Rahul K"; IDs stay as they are. */
export function displayName(payee: string | null, vpa: string | null): string | null {
  if (!payee) return null;
  if (isOpaquePayee(payee, vpa)) return payee;
  return payee
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

export interface CategorizeInput {
  direction: Direction;
  channel: Channel;
  payee: string | null;
  vpa: string | null;
  text: string;
}

export interface CategorizeResult {
  /** A built-in category, or the owner's own from their payee rule. */
  category: string;
  /** Clean display name, e.g. "Rahul Kumar", or the raw ID for QR payments. */
  merchant: string | null;
  source: CategorySource;
}

/** The owner's rule if there is one; otherwise undecided (the model is asked next). */
export function categorize(input: CategorizeInput, ownerRule?: string | null): CategorizeResult {
  const merchant = displayName(input.payee, input.vpa);
  const rule = ownerRule?.trim();
  if (rule) return { category: rule, merchant, source: 'user' };
  return { category: 'Other', merchant, source: 'unknown' };
}
