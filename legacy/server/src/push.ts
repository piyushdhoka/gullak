// Web Push. VAPID keys come from env, or are generated once and kept in the data folder.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as webpush from 'web-push';

import type { PushPayload } from './core/ingest-core.ts';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one notification. Throws an error with `statusCode` 404/410 when the subscription is gone. */
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<void>;

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function loadVapidKeys(dataDir: string): VapidKeys {
  const fromEnv = { publicKey: process.env.VAPID_PUBLIC_KEY ?? '', privateKey: process.env.VAPID_PRIVATE_KEY ?? '' };
  if (fromEnv.publicKey && fromEnv.privateKey) return fromEnv;
  const file = join(dataDir, 'vapid.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as VapidKeys;
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

export function webPushSender(keys: VapidKeys, subject: string): PushSender {
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return async (target, payload) => {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 3600, urgency: 'high' },
    );
  };
}
