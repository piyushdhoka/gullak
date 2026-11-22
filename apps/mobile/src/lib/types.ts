export type Direction = 'debit' | 'credit';
export type Channel = 'upi' | 'card' | 'netbanking' | 'atm' | 'other';

export interface Transaction {
  id: string;
  occurred_at: string;
  amount: number;
  direction: Direction;
  payee: string | null;
  payee_key: string | null;
  merchant: string | null;
  vpa: string | null;
  category: string;
  /** user / merchant / heuristic / model / unknown. `unknown` payees show up in Review. */
  category_source: 'user' | 'merchant' | 'heuristic' | 'model' | 'unknown';
  bank: string | null;
  account: string | null;
  upi_ref: string | null;
  channel: Channel;
  source: 'sms' | 'manual';
  note: string | null;
  hidden: boolean;
  sms_id: string | null;
}

export type SmsStatus = 'pending' | 'parsed' | 'duplicate' | 'ignored' | 'unrecognised' | 'dismissed';

/** One payee nothing could categorise, with all its payments grouped. */
export interface ReviewItem {
  key: string;
  merchant: string | null;
  payee: string | null;
  vpa: string | null;
  count: number;
  total: number;
  last_at: string;
}

export interface SmsMessage {
  id: string;
  body: string;
  received_at: string;
  status: SmsStatus;
  reason: string | null;
}
