// Entry point: env config, SQLite, push, optional classifier, static app, daily backups.

import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import type { ClassifyResult } from './core/ingest-core.ts';
import { openDb, type DB } from './db.ts';
import { loadVapidKeys, webPushSender } from './push.ts';
import { serveApp } from './static.ts';

const env = process.env;
const PORT = Number(env.PORT ?? 8787);
const HOST = env.HOST ?? '127.0.0.1';
const DATA_DIR = resolve(env.DATA_DIR ?? './data');
const STATIC_DIR = env.STATIC_DIR ? resolve(env.STATIC_DIR) : null;
const PUBLIC_URL = env.PUBLIC_URL ?? `http://localhost:${PORT}`;

mkdirSync(join(DATA_DIR, 'backups'), { recursive: true });
const db = openDb(join(DATA_DIR, 'gullak.db'));

const vapid = loadVapidKeys(DATA_DIR);
// Apple's push service needs a valid contact: https URL or mailto.
const subject = env.VAPID_SUBJECT ?? (PUBLIC_URL.startsWith('https://') ? PUBLIC_URL : 'mailto:owner@gullak.invalid');

async function classifyViaHttp(input: unknown): Promise<ClassifyResult | null> {
  const res = await fetch(env.CLASSIFIER_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CLASSIFIER_TOKEN ?? ''}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(Number(env.CLASSIFIER_TIMEOUT_MS ?? 1500)),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { category?: unknown; confidence?: unknown };
  return typeof body.category === 'string' && typeof body.confidence === 'number'
    ? { category: body.category, confidence: body.confidence }
    : null;
}

const app = createApp({
  db,
  push: webPushSender(vapid, subject),
  vapidPublicKey: vapid.publicKey,
  classify: env.CLASSIFIER_URL ? classifyViaHttp : undefined,
  minConfidence: env.CLASSIFIER_MIN_CONFIDENCE ? Number(env.CLASSIFIER_MIN_CONFIDENCE) : undefined,
  allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  allowSignup: env.ALLOW_SIGNUP === '1',
  shortcutUrl: env.SHORTCUT_URL?.startsWith('https://www.icloud.com/shortcuts/') ? env.SHORTCUT_URL : undefined,
});
if (STATIC_DIR) app.use('*', serveApp(STATIC_DIR));

// ---------- daily backups (keeps the last 14) ----------
function backup(database: DB) {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(DATA_DIR, 'backups', `gullak-${day}.db`);
  try {
    rmSync(file, { force: true });
    database.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const old = readdirSync(join(DATA_DIR, 'backups'))
      .filter((f) => /^gullak-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort()
      .slice(0, -14);
    for (const f of old) rmSync(join(DATA_DIR, 'backups', f), { force: true });
  } catch (err) {
    console.error('backup failed', err);
  }
}
backup(db);
setInterval(() => backup(db), 24 * 3_600_000).unref();

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`gullak server on http://${info.address}:${info.port} (data: ${DATA_DIR}${STATIC_DIR ? `, app: ${STATIC_DIR}` : ''})`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    db.close();
    process.exit(0);
  });
}
