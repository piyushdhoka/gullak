# Gullak

Automatic expense tracking for India. Every bank SMS on your iPhone (GPay, PhonePe, cards, NEFT…) is
forwarded by an iOS Shortcut to your own server, parsed, categorised, and pushed back to your phone:
`−₹250.00 · Swiggy` / `Food · HDFC Bank •1234`.

- **App:** Expo (React Native) exported as an installable web app (PWA) with an iOS-style UI; the
  same code can later become a native App Store app.
- **Server:** Node 24 + Hono + built-in SQLite on EC2, behind Caddy (automatic HTTPS). Serves the
  app, the API, and `/ingest` for the Shortcut. Daily backups.
- **Categorising:** your choices → known merchants → signals → optional small model (readable
  names only, confidence-gated) → one-tap **Review** for QR codes and IDs.

## Layout

| Path | What |
| --- | --- |
| `src/app/` | Screens: Summary, Activity, Setup, Settings, Review, payment detail, Not recognised |
| `src/ui/` | iOS-style components (grouped lists, large-title nav bar, buttons, icons, HIG colours) |
| `src/lib/` | API client, data layer (+ demo data), dashboard maths, push, formatting |
| `server/src/core/` | SMS parser, categoriser, capture pipeline (pure TypeScript, unit-tested) |
| `server/src/` | HTTP API, SQLite, auth, push, static app serving, backups |
| `deploy/` | `deploy.ps1` (Windows → EC2) and `remote-setup.sh` |
| `tests/` | Vitest unit + API tests |
| `docs/` | Design spec and setup guide |

## Commands

```bash
npm run server       # API on :8787
npm run web          # app on :8081
npm test
npm run typecheck    # app, tests and server
npm run lint
.\deploy\deploy.ps1  # build and deploy to EC2
```

Setup and deployment: [docs/SETUP.md](docs/SETUP.md).
