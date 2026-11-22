// Best-effort reading of a bank SMS that the real parser couldn't turn into a payment, so the
// "Add as payment" sheet can start pre-filled. Every field is a guess the person checks before saving.

export interface SmsGuess {
  direction: 'debit' | 'credit';
  /** Plain digits ("1250.5"), or '' when no amount could be found. */
  amount: string;
  payee: string;
}

const CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversed|reversal)\b/i;
const DEBIT = /\b(debited|debit|sent|spent|paid|withdrawn|withdrawal|purchased?|deducted|transferred)\b/i;
// Rs / INR / ₹, and the "$" people type in tests; bank formats like "Rs.1,250.00" or "INR 10".
const AMOUNT = /(?:rs\.?|inr|₹|\$)\s*\.?\s*([\d,]+(?:\.\d{1,2})?)/i;
const PAYEE = /\b(?:to|from|by)\s+(?:(?:a\/c\s+linked\s+to\s+)?vpa\s+)?\*?([a-z0-9][a-z0-9 .&'@_-]{1,40}?)(?=\s+(?:on|ref|via|at|upi|a\/c|acct|avl|bal)\b|[,;:\n(]|\.\s|\.$|$)/gi;

export function guessFromSms(body: string): SmsGuess {
  const text = body.replace(/\b(credit|debit)\s*card\b/gi, 'card');
  const c = text.search(CREDIT);
  const d = text.search(DEBIT);
  const direction: SmsGuess['direction'] = c >= 0 && (d < 0 || c < d) ? 'credit' : 'debit';

  const raw = AMOUNT.exec(text)?.[1]?.replace(/,/g, '') ?? '';
  const n = Number(raw);
  const amount = raw && Number.isFinite(n) && n > 0 && n <= 1e8 ? String(n) : '';

  // The first "to / from / by" that isn't our own account ("From HDFC Bank A/C *1234") is the other party.
  const payee =
    [...text.matchAll(PAYEE)].map((m) => m[1].trim()).find((who) => !/\b(bank|a\/c|acct|account|card)\b/i.test(who)) ?? '';

  return { direction, amount, payee };
}
