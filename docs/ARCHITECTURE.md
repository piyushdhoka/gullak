# Architecture

**Goal:** an Android app (APK) and an iPhone Home Screen app (PWA), one codebase, one backend.
There is no marketing website; the web build exists only so iPhones can install the app.

```
apps/mobile/        Expo (SDK 58) app
                      - Android: native build (expo run:android / EAS) → APK, reads SMS itself
                      - iPhone: web build (expo export -p web) → PWA served from gullak.sparkstudio.co.in
packages/core/      @gullak/core: SMS parser, categoriser, capture pipeline (pure TypeScript)
                      used by: Supabase ingest function, Android app (on-device), tests
supabase/
  migrations/       schema, row-level security, SQL functions (summaries, recurring, export…)
  functions/        Edge Functions: ingest (capture), config (public settings)
infra/              EC2 + Caddy: serves the PWA, forwards /ingest to Supabase; deploy.ps1
legacy/server/      old Node + SQLite server, kept only until the first user's data is moved; then delete
docs/               this file, API.md (backend contract), ANDROID.md, FEATURES.md, SETUP.md
```

## How a payment gets in

```
iPhone:   bank SMS → Shortcuts automation → POST gullak.sparkstudio.co.in/ingest/<capture key>
                                              → Caddy → Supabase function `ingest`
Android:  bank SMS → app's SMS receiver → looksFinancial() on the phone → POST functions/v1/ingest
                                              (user's token; batches for imports)

ingest → @gullak/core.processCapture
         → store raw SMS (sms_inbox) → parse → categorise (user rule → known merchant → heuristics
           → optional AI → "needs review") → dedupe (UPI ref / SMS hash) → transactions
         → push: Web Push (iPhone) / Expo push (Android)
apps   ← Realtime on `transactions` + SQL functions for summaries
```

## Principles
- **One parser.** `packages/core` is the only place that understands SMS. Fix a bank format once.
- **Backend does the maths.** Totals, trends, recurring detection and exports are SQL functions, so both
  apps show the same numbers and the UI stays thin.
- **Security by row-level security.** Apps hold only the publishable key; every table checks `auth.uid()`.
  The only privileged code is in Edge Functions (service key from Supabase's environment).
- **Idempotent capture.** Every message can be sent again safely (dedupe keys), so apps can retry freely.

## Commands (repo root)
| | |
|---|---|
| `npm install` | installs all workspaces |
| `npm run web` | iOS PWA dev server |
| `npm run android` | Android dev build (needs Android SDK) |
| `npm test` | parser, categoriser, pipeline, stats tests |
| `npm run typecheck` | app + core + Edge Functions |
| `npm run deploy` | build PWA and deploy to EC2 (needs `GULLAK_HOST`, `GULLAK_KEY`) |
