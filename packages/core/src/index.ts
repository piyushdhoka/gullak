// @gullak/core: everything that turns a bank SMS into a categorised payment.
// Pure TypeScript with explicit .ts imports, so the same files run in Supabase Edge Functions (Deno),
// the Android app (React Native, parsing on the phone) and the tests (Node).

export * from './parse-sms.ts';
export * from './categorize.ts';
export * from './ingest-core.ts';
export * from './stats.ts';
export * from './jars.ts';
export type { ReviewItem, SmsMessage, Transaction } from './types.ts';
export * from './ask.ts';
export * from './guard.ts';
export * from './decision.ts';
