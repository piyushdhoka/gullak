// Remembers, on this device, which jars have already had their "break the Gullak" moment,
// so it plays once per jar and not every time the jar is opened.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gullak.jarBreaks';

async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function hasBrokenJar(id: string): Promise<boolean> {
  return (await read()).includes(id);
}

export async function markJarBroken(id: string): Promise<void> {
  try {
    const list = await read();
    if (!list.includes(id)) await AsyncStorage.setItem(KEY, JSON.stringify([...list, id].slice(-200)));
  } catch {
    // Not remembering only means the celebration might play again.
  }
}
