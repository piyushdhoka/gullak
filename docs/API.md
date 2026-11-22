# Gullak backend API (for the Android app and the iOS PWA)

Everything is Supabase. Apps use `@supabase/supabase-js` with the project URL and the **publishable**
key; row-level security makes every query return only the signed-in user's rows.

- Project: `https://rupjxysgksruhhlokbvx.supabase.co`
- Times are `timestamptz` (UTC). Months and days in summaries use India time (Asia/Kolkata).
- Money is `numeric` rupees (may arrive as a string; convert with `Number()`).
- **Spent** = every debit that isn't hidden.

## Auth (email + password)

| Step | Call |
|---|---|
| Sign up | `auth.signUp({ email, password, options: { emailRedirectTo: SITE_URL } })` → returns no session until confirmed |
| Confirm with the emailed code | `auth.verifyOtp({ email, token, type: 'signup' })` |
| Resend code | `auth.resend({ type: 'signup', email })` |
| Sign in | `auth.signInWithPassword({ email, password })` |
| Forgot password | `auth.resetPasswordForEmail(email, { redirectTo: SITE_URL })` |
| Reset with code | `auth.verifyOtp({ email, token, type: 'recovery' })` then `auth.updateUser({ password })` |
| Sign out | `auth.signOut()` |
| Delete account | `rpc('delete_my_account')` |

`SITE_URL` is always `https://gullak.sparkstudio.co.in` (see `apps/mobile/src/lib/api.ts`), so email links
never point at localhost. Wrappers for all of these: `apps/mobile/src/lib/api.ts`.

## Capture: `POST /functions/v1/ingest`

| Who | Auth | Body |
|---|---|---|
| iPhone Shortcut | capture key in the path: `/ingest/<key>` (via `https://gullak.sparkstudio.co.in/ingest/<key>`) | `{ "text", "received_at" }` or raw text |
| Android, live | `Authorization: Bearer <access token>` | `{ "messages": [{ "text", "received_at" }] }` |
| Android, import past SMS | same | `{ "messages": [...up to 500], "backfill": true }` (keeps old dates, no push per item, one summary push) |
| App test button | same | `{ "text", "test": true }` |

Single message → `{ status: "saved" | "duplicate" | "ignored" | "unrecognised", transaction?, reason? }`.
Batch → `{ saved, duplicate, ignored, unrecognised, results: [...] }`.
Duplicates (same UPI ref, or same SMS text) are skipped, so resending is always safe.

`GET /functions/v1/config` → `{ vapidPublicKey, shortcutUrl }` (public).

## Tables (read/write your own rows)

| Table | Use |
|---|---|
| `transactions` | Payments. Update `category` (prefer `set_category`), `note`, `hidden`, `tags`. Insert with `source: 'manual'` for cash. |
| `sms_inbox` | Raw bank SMS. Show `status = 'unrecognised'` ones; set `status = 'dismissed'` to hide. |
| `payee_rules` | Payee → category the user chose (written by the RPCs). |
| `categories` | User's own categories (`name, emoji, color, kind`). |
| `budgets` | `category, monthly_limit`. |
| `devices` | Push targets. Web: `platform 'web', endpoint, p256dh, auth`. Android: `platform 'android', expo_token`. Upsert on `endpoint` / `expo_token`. |
| `capture_keys` | Read `key_hint, last_used_at`. Create/replace with `rpc('create_capture_key')` (returns the key once). |
| `account_balances` (view) | Latest balance per bank + account. |

Realtime: subscribe to `transactions`, `budgets`, `categories` (filter `user_id=eq.<id>`).

## Functions (`supabase.rpc(name, args)`)

| Function | Returns |
|---|---|
| `month_summary({ p_month })` | `{ month, spent, received, count, days_counted, avg_per_day, prev_month_spent, needs_review, by_category[{category,total,count,budget}], top_merchants[], by_day[] }` |
| `spending_trend({ p_months = 6 })` | rows `{ month, spent, received, count }`, oldest first |
| `recurring_payments()` | rows `{ payee_key, merchant, category, typical_amount, months, last_at, next_expected }` |
| `list_categories()` | built-in + own: `{ name, emoji, color, kind, builtin }` |
| `set_category({ p_txn, p_category, p_apply_all })` | changes one payment (or all from that payee) and remembers it |
| `resolve_review({ p_key, p_category })` | Review screen: `p_key` is a payee key or `txn:<id>` |
| `export_transactions({ p_from, p_to })` | flat rows for CSV |
| `create_capture_key()` | new capture key (iPhone) |
| `delete_my_account()` | deletes the user and all their data |

Generated TypeScript types: `packages/core/src/database.types.ts` (regenerate after migrations).
