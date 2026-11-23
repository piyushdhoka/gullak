// Android: read bank SMS on this phone and send them to Gullak's ingest function (the same one the iPhone
// Shortcut reaches; signed in, it knows who you are). Only SMS from registered sender IDs ("VM-HDFCBK")
// that look like payments leave the phone; personal messages are never read or sent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBankSender, looksFinancial } from '@gullak/core';
import { PermissionsAndroid, Platform } from 'react-native';

import { SmsInbox, type InboxSms } from '../../modules/sms-inbox';
import { supabase } from './api';

/** Messages per request: the server checks every payee (sometimes with an AI call), so requests stay short. */
const BATCH = 50;
const PAGE = 500;
/** The server keeps the phone's time for SMS up to 2 days old; older ones (app not opened for days) go as an
 * import, silently, so they keep their real dates. */
const RECENT_MS = 2 * 86_400_000;

/** False on web, iPhone and Expo Go (no native SMS reader there). */
export const smsSupported = Platform.OS === 'android' && SmsInbox != null;

const markKey = (userId: string) => `gullak.sms.since.${userId}`;

/** Time (ms) of the newest SMS read so far, or null while SMS capture is off. */
export async function smsMark(userId: string): Promise<number | null> {
  const v = await AsyncStorage.getItem(markKey(userId));
  return v ? Number(v) : null;
}

/** Turns capture on from this moment: SMS already on the phone are never read or sent. */
export async function startSms(userId: string): Promise<number> {
  const mark = (await smsMark(userId)) ?? Date.now();
  await AsyncStorage.setItem(markKey(userId), String(mark));
  return mark;
}

export function hasSmsPermission(): Promise<boolean> {
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function askSmsPermission(): Promise<boolean> {
  return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS)) === PermissionsAndroid.RESULTS.GRANTED;
}

export interface SyncResult {
  /** Bank SMS sent to the server. */
  sent: number;
  /** New payments saved. */
  saved: number;
  /** Already in Gullak. */
  duplicate: number;
}

let running: Promise<SyncResult> | null = null;

/**
 * Sends bank SMS that arrived after the last sync (never before startSms). Resumable: the mark moves forward
 * after every batch, so an interrupted run picks up where it stopped. One run at a time (opening the app and
 * tapping Check can't send the same SMS twice).
 */
export function syncSms(userId: string, opts: { onProgress?: (r: SyncResult) => void } = {}): Promise<SyncResult> {
  running ??= run(userId, opts).finally(() => {
    running = null;
  });
  return running;
}

async function run(userId: string, { onProgress }: { onProgress?: (r: SyncResult) => void }) {
  if (!SmsInbox) throw new Error('Reading SMS needs the installed Gullak app.');
  const total: SyncResult = { sent: 0, saved: 0, duplicate: 0 };
  // shortcut: two SMS in the same millisecond across a page edge would skip the second; fine for bank alerts.
  let since = await smsMark(userId);
  if (since === null) return total;
  for (;;) {
    const page = await SmsInbox.readInbox(since, PAGE);
    if (!page.length) break;
    const bank = page.filter((m) => isBankSender(m.address) && looksFinancial(m.body));
    for (let i = 0; i < bank.length; i += BATCH) {
      const chunk = bank.slice(i, i + BATCH);
      await send(chunk, total);
      await AsyncStorage.setItem(markKey(userId), String(chunk[chunk.length - 1].date));
      onProgress?.({ ...total });
    }
    since = page[page.length - 1].date;
    await AsyncStorage.setItem(markKey(userId), String(since));
    if (page.length < PAGE) break;
  }
  return total;
}

async function send(chunk: InboxSms[], total: SyncResult) {
  const now = Date.now();
  const old = chunk.filter((m) => now - m.date > RECENT_MS);
  const recent = chunk.filter((m) => now - m.date <= RECENT_MS);
  for (const [list, backfill] of [[old, true], [recent, false]] as const) {
    if (!list.length) continue;
    const { data, error } = await supabase.functions.invoke<{ saved: number; duplicate: number }>('ingest', {
      body: { messages: list.map((m) => ({ text: m.body, received_at: new Date(m.date).toISOString() })), backfill },
    });
    if (error || !data) throw error ?? new Error('Gullak did not answer');
    total.sent += list.length;
    total.saved += data.saved;
    total.duplicate += data.duplicate;
  }
}
