# Gulलक · Gullak

Every rupee, sorted on its own. Gullak turns the SMS your bank already sends into a categorised,
totalled expense: no bank login, no typing.

- **Android app (APK):** reads bank SMS directly, can import past months.
- **iPhone app (PWA):** installed from Safari; an iOS Shortcut forwards bank SMS.
- **Backend:** Supabase (Postgres with row-level security, Edge Functions, Realtime, Auth).

```
apps/mobile      Expo app: Android build + iOS PWA (web build)
packages/core    @gullak/core: SMS parser, categoriser, capture pipeline (shared everywhere)
supabase         migrations + Edge Functions (ingest, config)
infra            EC2 + Caddy deploy for the PWA and the /ingest address
legacy/server    old SQLite server, removed after data migration
docs             ARCHITECTURE, API (backend contract), ANDROID, FEATURES, SETUP
```

## Develop
```bash
npm install          # all workspaces
npm run web          # PWA dev server (http://localhost:8081)
npm test             # parser / categoriser / pipeline / stats tests
npm run typecheck    # app, core and Edge Functions
npm run lint
```

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then [docs/API.md](docs/API.md).
Feature ideas and roadmap: [docs/FEATURES.md](docs/FEATURES.md). Android SMS plan: [docs/ANDROID.md](docs/ANDROID.md).
