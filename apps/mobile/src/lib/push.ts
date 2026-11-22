// Web Push on iPhone: works for web apps added to the Home Screen (iOS 16.4+).

import { Platform } from 'react-native';

import { friendly, functionUrl, supabase } from './api';

export type PushState = 'unsupported' | 'needs-install' | 'default' | 'denied' | 'granted';

function isWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function isStandalone(): boolean {
  if (!isWeb()) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (!isWeb()) return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function pushState(): PushState {
  if (!isWeb()) return 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushState;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

/** Asks for permission, subscribes this device and saves the subscription. Must run from a tap. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  const state = pushState();
  if (state === 'needs-install') return { ok: false, message: 'Add the app to your Home Screen first, then open it from there.' };
  if (state === 'unsupported') return { ok: false, message: 'This browser does not support notifications.' };

  try {
    const { vapidPublicKey: publicKey } = await getConfig();
    if (!publicKey) return { ok: false, message: 'Notifications aren’t set up on the server yet.' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, message: 'Notifications were not allowed. Turn them on in Settings › Notifications.' };
    }

    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const json = sub.toJSON();
    const { error } = await supabase.from('devices').upsert(
      {
        platform: 'web',
        name: isIOS() ? 'iPhone' : 'Browser',
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent.slice(0, 300),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

export interface AppConfig {
  vapidPublicKey: string | null;
  /** iCloud link to the shared "Gullak Capture" Shortcut, once published. */
  shortcutUrl: string | null;
}

let config: Promise<AppConfig> | null = null;

/** Public settings from the `config` Edge Function (cached for the visit). */
export function getConfig(): Promise<AppConfig> {
  config ??= fetch(functionUrl('config'))
    .then((r) => (r.ok ? (r.json() as Promise<AppConfig>) : Promise.reject(new Error(`config ${r.status}`))))
    .catch((e) => {
      config = null;
      throw e;
    });
  return config;
}

export async function hasSubscription(): Promise<boolean> {
  if (!isWeb() || !('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (isWeb() && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
