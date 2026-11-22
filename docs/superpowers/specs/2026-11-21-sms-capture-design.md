# SMS Capture (v1) — Design

## Intent

Track every UPI / card / bank payment (≈99% of spending is online: GPay, PhonePe, cards)
with **zero manual entry**. The owner is "lazy" about logging and sorting, so capture and
categorisation must be automatic and instant. Budgets, investments and trip planning come
later and will be designed from the captured data — **v1 is capture only**.

## Goals

- A bank SMS on the owner's iPhone becomes a categorised transaction within seconds.
- An instant push notification: `−₹250 · Swiggy · Food`.
- iOS-native look and feel (Apple HIG): grouped lists, large titles, SF font, system colours,
  light + dark mode.
- Runs forever for free on iPhone (no 7-day re-signing, no Mac).

- A small dashboard: month spend vs same days last month, received/net, daily average,
  projected month end, average of previous 3 months, daily spend chart, spend by category,
  top merchants, biggest payment. *(Added 2026-11-21.)*
- The Shortcut forwards **every** message; the server keeps only financial ones and drops the
  rest without storing them. *(Added 2026-11-21.)*

## Non-goals (v1)

Budgets, goals, trips, investments, Account Aggregator, statement import, multi-user
features, native iOS build. The EC2 classifier is designed as an optional hook
(`CLASSIFIER_URL`), built separately.

## Anti-goals

- Losing an SMS silently. Every SMS received is stored raw, even when it can't be parsed.
- Counting one payment twice.
- Requiring the owner to categorise everything by hand.

## Constraints

- iPhone + Windows PC (no Mac). iOS apps cannot read SMS; iOS Shortcuts can react to them.
- Free tiers only.
- Expo SDK 58 (React Native 0.88, Expo Router). HeroUI Native is not supported on web, so the
  iOS-style components are hand-built from React Native primitives.

## Approaches considered

1. **PWA + backend (chosen).** Shortcut → HTTPS POST → backend parses → push. Free, never
   expires, instant. SMS text leaves the phone (to the owner's own backend).
2. Native app via Sideloadly (free Apple ID). On-device, but app expires every 7 days and needs
   the PC for auto-refresh.
3. Native app via TestFlight/App Store. Best, but $99/yr. Deferred: the same Expo code base
   will be built natively later.

Frontend: Expo (web output now, native later) over Vite/React, so the UI isn't rewritten for
the App Store.

## Revision 2026-11-21: own server on EC2 instead of Supabase

The owner chose to host the backend on their EC2 instance (no third-party cloud). The design
below is otherwise unchanged except:

- **Server:** Node 24 + Hono + `node:sqlite` on EC2 (`gullak.sparkstudio.co.in`), Caddy for HTTPS,
  systemd, daily `VACUUM INTO` backups (14 kept). The server also serves the exported web app.
- **Auth:** email + password (scrypt), bearer session tokens; the first sign-up is the owner and
  sign-up then closes.
- **Live updates:** polling every 20 s while open + refresh on foreground + the service worker tells
  the open app to refresh when a push arrives (instead of Supabase Realtime).
- **Categorising unreadable payees:** most UPI payees are QR/gateway IDs a model can't interpret.
  These are detected (`isOpaquePayee`), never guessed and never sent to the model, and land in a
  **Review** screen grouped by payee — one tap categorises all past and future payments to it.
  Readable names get keyword rules (MEDICAL → Health…) and then the optional model, used only
  above a confidence threshold. Each transaction records `category_source`
  (user / merchant / heuristic / model / unknown).

The Supabase sections below describe the superseded first version.

## Architecture

```
iOS Shortcut (Message automation, Run Immediately)
  └─ POST {text, received_at}  header x-capture-key
       └─ Supabase Edge Function `ingest`
            ├─ store raw SMS in sms_inbox (always)
            ├─ parse (bank regex rules)  → ignored / unrecognised / transaction
            ├─ categorise (owner's payee rules → built-in merchant keywords)
            ├─ de-duplicate (UPI ref, else amount+direction+account+minute)
            ├─ insert transaction
            └─ Web Push to every saved subscription
Expo PWA (Home Screen)  ← Supabase Auth (email code) + Realtime
```

### Backend (Supabase)

Tables (all with RLS `user_id = auth.uid()`): `transactions`, `sms_inbox`, `payee_rules`,
`push_subscriptions`, `capture_keys`. The capture key is random, shown once, and stored as a
SHA-256 hash. `ingest` runs with JWT verification off and authenticates by capture key.

### Parser

Pure TypeScript (Deno + Node compatible, no dependencies) in
`supabase/functions/_shared/`. Extracts amount, direction, payee, bank, account last digits,
UPI reference and channel. Ignores OTPs, collect requests, failed/declined payments,
future-debit notices, promotions, reminders. Tested with Vitest against realistic,
anonymised SMS samples per bank.

### App

Tabs: **Activity** (month summary + transactions grouped by day, live updates), **Setup**
(notifications, capture key, Shortcut steps, send test SMS), **Settings** (account,
"Not recognised" SMS review, sign out). Transaction detail sheet: change category (remember
for this payee, optionally re-apply to past payments), note, hide, original SMS.
A **demo mode** (no Supabase env vars) shows sample data so the UI can be previewed.

### PWA

`web.output: static`, `+html.tsx` with manifest, Apple meta tags, and a small hand-written
service worker that only handles push (no aggressive caching, so updates are never stuck).

## Builder's calls (made, can be revisited)

- Email **code** sign-in instead of magic link: on iOS a magic link opens Safari, not the
  installed web app, which has separate storage.
- Received time = time the Shortcut ran (SMS dates are inconsistent across banks).
- Categories: Food, Groceries, Shopping, Transport, Travel, Bills, Entertainment, Health,
  Investments, Transfers, Cash, Income, Refund, Other.
- No AI categoriser in v1; keyword rules + learned payee rules. AI fallback is a later add.
