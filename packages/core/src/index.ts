// @gullak/core: everything that turns a bank SMS into a categorised payment.
// Pure TypeScript with explicit .ts imports, so the same files run in Supabase Edge Functions (Deno),
// the Android app (React Native, parsing on the phone) and the tests (Node).

export * from './parse-sms.ts';
export * from './categorize.ts';
export * from './ingest-core.ts';
export * from './classify.ts';
