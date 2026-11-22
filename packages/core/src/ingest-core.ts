// The capture pipeline, independent of the database and HTTP layer so it can be unit-tested.
// The Supabase ingest function wires these deps to Postgres and push notifications.

import { categorize, isCategory, type CategorySource } from './categorize.ts';
import type { ClassifyInput, ClassifyResult } from './classify.ts';
import { parseSms, type Channel, type Direction } from './parse-sms.ts';

export type SmsStatus = 'parsed' | 'duplicate' | 'ignored' | 'unrecognised';

export interface NewTransaction {
  user_id: string;
  sms_id: string;
  occurred_at: string;
  amount: number;
  direction: Direction;
  payee: string | null;
  payee_key: string | null;
  merchant: string | null;
  vpa: string | null;
  category: string;
  category_source: CategorySource;
  bank: string | null;
  account: string | null;
  upi_ref: string | null;
  channel: Channel;
  dedupe_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type { ClassifyInput, ClassifyResult } from './classify.ts';

/** Model answers below this probability are not used; the payee goes to Review instead. */
export const MODEL_MIN_CONFIDENCE = 0.6;

export interface IngestDeps {
  insertSms(row: { user_id: string; body: string; received_at: string }): Promise<string>;
  updateSms(id: string, patch: { status: SmsStatus; reason: string | null }): Promise<void>;
  getPayeeRule(userId: string, payeeKey: string): Promise<string | null>;
  /**
   * The category model (classify.ts). Asked for every payment the owner hasn't categorised before.
   * May return null or throw: the payment is still saved and goes to Review.
   */
  classify?(input: ClassifyInput): Promise<ClassifyResult | null>;
  /** Returns the new row id, or null when dedupe_key already exists for this user. */
  insertTransaction(row: NewTransaction): Promise<string | null>;
  notify(userId: string, payload: PushPayload): Promise<void>;
}

export interface CaptureInput {
  userId: string;
  text: string;
  receivedAt?: string | null;
  now?: Date;
  /** Override MODEL_MIN_CONFIDENCE. */
  minConfidence?: number;
}

export type CaptureResult =
  | { status: 'saved'; transactionId: string; transaction: NewTransaction }
  | { status: 'duplicate' }
  | { status: 'ignored' | 'unrecognised'; reason: string };

const MAX_SMS_LENGTH = 2000;

// The Shortcut forwards every incoming message. Anything that doesn't look like a bank or
// payment message (personal chats, OTP-less notifications) is dropped without being stored.
const FINANCIAL =
  /(?:rs\.?|inr|₹)\s*[\d,]+|\b(debited|credited|a\/c|acct|account|upi|neft|imps|rtgs|card|txn|transaction|withdrawn|spent|refund)\b/i;

export function looksFinancial(text: string): boolean {
  return FINANCIAL.test(text);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function normaliseReceivedAt(value: string | null | undefined, now: Date): string {
  if (value) {
    const d = new Date(value);
    // Accept times up to 2 days old and not more than 5 minutes in the future.
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime() + 5 * 60_000 && d.getTime() >= now.getTime() - 2 * 86_400_000) {
      return d.toISOString();
    }
  }
  return now.toISOString();
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function formatPush(txn: NewTransaction, id: string): PushPayload {
  const sign = txn.direction === 'debit' ? '−' : '+';
  const who = txn.merchant ?? txn.payee ?? (txn.direction === 'debit' ? 'Payment' : 'Money received');
  const where = [txn.bank, txn.account ? `•${txn.account}` : null].filter(Boolean).join(' ');
  if (txn.category_source === 'unknown') {
    return {
      title: `${sign}${inr.format(txn.amount)} · ${who}`,
      body: 'New payee. Tap to pick a category once.',
      url: '/review',
      tag: id,
    };
  }
  return {
    title: `${sign}${inr.format(txn.amount)} · ${who}`,
    body: [txn.category, where].filter(Boolean).join(' · '),
    url: `/transaction?id=${id}`,
    tag: id,
  };
}

export async function processCapture(deps: IngestDeps, input: CaptureInput): Promise<CaptureResult> {
  const now = input.now ?? new Date();
  const text = (input.text ?? '').slice(0, MAX_SMS_LENGTH);
  const receivedAt = normaliseReceivedAt(input.receivedAt, now);

  if (!looksFinancial(text)) return { status: 'ignored', reason: 'not a bank message (not stored)' };

  // Keep the raw bank SMS first, so nothing financial is ever lost.
  const smsId = await deps.insertSms({ user_id: input.userId, body: text, received_at: receivedAt });

  const parsed = parseSms(text);
  if (parsed.kind !== 'transaction') {
    await deps.updateSms(smsId, { status: parsed.kind, reason: parsed.reason });
    return { status: parsed.kind, reason: parsed.reason };
  }

  const t = parsed.txn;
  const rule = t.payeeKey ? await deps.getPayeeRule(input.userId, t.payeeKey) : null;
  const guess = categorize({ direction: t.direction, channel: t.channel, payee: t.payee, vpa: t.vpa, text }, rule);
  const { merchant } = guess;
  let category: string = guess.category;
  let categorySource: CategorySource = guess.source;
  if (guess.source === 'unknown' && deps.classify) {
    try {
      const answer = await deps.classify({ payee: t.payee, vpa: t.vpa, direction: t.direction, text });
      if (answer && isCategory(answer.category) && answer.confidence >= (input.minConfidence ?? MODEL_MIN_CONFIDENCE)) {
        category = answer.category;
        categorySource = 'model';
      }
    } catch {
      // Model down or slow: leave it for Review.
    }
  }

  const dedupeKey = t.upiRef
    ? `upi:${t.upiRef}:${t.direction}`
    : `sms:${await sha256Hex(text.replace(/\s+/g, ' ').trim().toLowerCase())}`;

  const row: NewTransaction = {
    user_id: input.userId,
    sms_id: smsId,
    occurred_at: receivedAt,
    amount: t.amount,
    direction: t.direction,
    payee: t.payee,
    payee_key: t.payeeKey,
    merchant,
    vpa: t.vpa,
    category,
    category_source: categorySource,
    bank: t.bank,
    account: t.account,
    upi_ref: t.upiRef,
    channel: t.channel,
    dedupe_key: dedupeKey,
  };

  const id = await deps.insertTransaction(row);
  if (!id) {
    await deps.updateSms(smsId, { status: 'duplicate', reason: dedupeKey });
    return { status: 'duplicate' };
  }

  await deps.updateSms(smsId, { status: 'parsed', reason: null });
  try {
    await deps.notify(input.userId, formatPush(row, id));
  } catch {
    // A failed push must never lose the transaction.
  }
  return { status: 'saved', transactionId: id, transaction: row };
}
