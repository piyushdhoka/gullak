import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/** Reads a browser-only value after hydration; `server` is used during static rendering. */
export function useClientValue<T extends string | number | boolean | null>(read: () => T, server: T): T {
  return useSyncExternalStore(noSubscribe, read, () => server);
}
