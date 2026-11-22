// The person's appearance choice: follow the phone ('system'), or always 'light' / 'dark'.
// Kept on the device. The web reads it synchronously from localStorage (no flash on load);
// native loads it from AsyncStorage once and then updates.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'gullak.theme';
const isPref = (v: unknown): v is ThemePref => v === 'system' || v === 'light' || v === 'dark';

function readWeb(): ThemePref {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    return isPref(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref: ThemePref = Platform.OS === 'web' ? readWeb() : 'system';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (Platform.OS !== 'web') {
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (isPref(v) && v !== pref) {
        pref = v;
        notify();
      }
    })
    .catch(() => {});
}

export function setThemePref(next: ThemePref) {
  pref = next;
  notify();
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
  } else {
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The saved choice. 'system' while pre-rendering on the server. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, () => pref, () => 'system');
}
