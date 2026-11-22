# Android: reading bank SMS directly

Yes, Android can do what the iPhone Shortcut does, without the Shortcut.

## How
1. **Permissions:** `RECEIVE_SMS` (new messages) and `READ_SMS` (import past messages), asked once at
   onboarding with a clear explanation.
2. **Live capture:** a small native module (Expo Modules API, Kotlin) registers a `BroadcastReceiver` for
   `SMS_RECEIVED`. It runs even when the app is closed, filters with `looksFinancial` logic, and enqueues
   a WorkManager job that POSTs to `/functions/v1/ingest` with the user's token. Offline? WorkManager
   retries when the network is back. Duplicates are harmless (server dedupes).
3. **Import history:** on first launch, read the SMS inbox (`content://sms/inbox`, last 24 months),
   keep only messages from bank sender IDs / financial-looking text, send in batches of 500 with
   `backfill: true`. One summary notification at the end.
4. **Notifications:** `expo-notifications` → Expo push token → `devices` row (`platform: 'android'`).
5. **Session:** supabase-js with AsyncStorage; the native receiver reads the token from shared storage
   (or the module asks JS to refresh it).

Config lives in `app.json` + a config plugin (`plugins/with-sms-receiver`), never by editing `android/`
by hand (Continuous Native Generation).

## Distribution
- **APK (sideload)**: no restrictions on SMS permissions. Build with EAS (`eas build -p android --profile preview`)
  or locally (`npx expo run:android --variant release`).
- **Google Play**: SMS permissions are restricted to approved use cases and need a declaration form and review.
  Ship the APK first; apply for Play later.

## What stays the same as iPhone
Same backend, same parser (`@gullak/core`), same screens (`apps/mobile`), same account.
