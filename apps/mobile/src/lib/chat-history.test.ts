import { describe, expect, it } from 'vitest';

import {
  CHAT_MAX_MESSAGES,
  CHAT_TTL_MS,
  chatKey,
  clearAllChats,
  clearChat,
  contextForServer,
  loadChat,
  pruneChat,
  saveChat,
  type ChatMessage,
  type ChatStore,
} from './chat-history';

/** In-memory stand-in for AsyncStorage / localStorage. */
function memoryStore(initial: Record<string, string> = {}): ChatStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
    getAllKeys: async () => [...data.keys()],
  };
}

const NOW = Date.parse('2026-11-22T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const q = (content: string, at: number): ChatMessage => ({ role: 'user', content, at });
const a = (content: string, at: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({ role: 'assistant', content, at, sig: `sig-${content}`, ...extra });

describe('pruneChat', () => {
  it('keeps the last 24 hours (rolling) and drops older messages', () => {
    const out = pruneChat(
      [q('old', NOW - 25 * HOUR), a('old answer', NOW - 25 * HOUR), q('new', NOW - 23 * HOUR), a('new answer', NOW - 23 * HOUR)],
      NOW,
    );
    expect(out.map((m) => m.content)).toEqual(['new', 'new answer']);
  });

  it('expires exactly at 24 hours', () => {
    expect(pruneChat([q('edge', NOW - CHAT_TTL_MS)], NOW)).toEqual([]);
    expect(pruneChat([q('just in', NOW - CHAT_TTL_MS + 1000)], NOW)).toHaveLength(1);
  });

  it('never keeps an answer whose question expired', () => {
    const out = pruneChat([q('question', NOW - 24 * HOUR - 1000), a('answer', NOW - 24 * HOUR + 1000), q('next', NOW - HOUR)], NOW);
    expect(out.map((m) => m.content)).toEqual(['next']);
  });

  it('drops error bubbles, junk entries and future timestamps', () => {
    const out = pruneChat(
      [
        q('hi', NOW - HOUR),
        a('Slow down a little.', NOW - HOUR, { error: true }),
        { role: 'system', content: 'x', at: NOW } as unknown as ChatMessage,
        { role: 'user', content: 'no time' } as unknown as ChatMessage,
        q('from the future', NOW + 10 * HOUR),
        q('ok', NOW),
      ],
      NOW,
    );
    expect(out.map((m) => m.content)).toEqual(['hi', 'ok']);
  });

  it('caps how many messages are kept', () => {
    const many = Array.from({ length: CHAT_MAX_MESSAGES + 50 }, (_, i) => q(`q${i}`, NOW - HOUR + i));
    const out = pruneChat(many, NOW);
    expect(out).toHaveLength(CHAT_MAX_MESSAGES);
    expect(out[out.length - 1].content).toBe(`q${CHAT_MAX_MESSAGES + 49}`);
  });
});

describe('contextForServer', () => {
  it('sends only the last 10 messages, keeps signatures, drops errors and extra fields', () => {
    const day = Array.from({ length: 30 }, (_, i) => (i % 2 ? a(`a${i}`, NOW - HOUR + i, { used: ['spending'] }) : q(`q${i}`, NOW - HOUR + i)));
    day.push(a('rate limited', NOW, { error: true }));
    const out = contextForServer(day);
    expect(out).toHaveLength(10);
    expect(out[0]).toEqual({ role: 'user', content: 'q20' });
    expect(out[1]).toEqual({ role: 'assistant', content: 'a21', sig: 'sig-a21' });
    expect(out.some((m) => m.content === 'rate limited')).toBe(false);
    expect(JSON.stringify(out).length).toBeLessThan(16 * 1024);
  });
});

describe('save / load', () => {
  it('round-trips a chat for one user and keeps signatures', async () => {
    const store = memoryStore();
    await saveChat(store, 'u1', [q('chai?', NOW - HOUR), a('₹30 on chai.', NOW - HOUR)], NOW);
    const back = await loadChat(store, 'u1', NOW);
    expect(back).toEqual([q('chai?', NOW - HOUR), a('₹30 on chai.', NOW - HOUR)]);
    expect(await loadChat(store, 'u2', NOW)).toEqual([]);
  });

  it('a saved chat expires on load once 24 hours have passed', async () => {
    const store = memoryStore();
    await saveChat(store, 'u1', [q('chai?', NOW), a('₹30.', NOW)], NOW);
    expect(await loadChat(store, 'u1', NOW + 23 * HOUR)).toHaveLength(2);
    expect(await loadChat(store, 'u1', NOW + 24 * HOUR)).toEqual([]);
  });

  it('removes the saved entry when nothing is left to keep', async () => {
    const store = memoryStore();
    await saveChat(store, 'u1', [q('x', NOW)], NOW);
    expect(store.data.has(chatKey('u1'))).toBe(true);
    await saveChat(store, 'u1', [a('only an error', NOW, { error: true })], NOW);
    expect(store.data.has(chatKey('u1'))).toBe(false);
  });

  it('survives corrupt or old-format data and broken storage', async () => {
    expect(await loadChat(memoryStore({ [chatKey('u1')]: '{not json' }), 'u1', NOW)).toEqual([]);
    expect(await loadChat(memoryStore({ [chatKey('u1')]: JSON.stringify([q('x', NOW)]) }), 'u1', NOW)).toEqual([]);
    const broken: ChatStore = {
      getItem: async () => {
        throw new Error('blocked');
      },
      setItem: async () => {
        throw new Error('full');
      },
      removeItem: async () => {
        throw new Error('blocked');
      },
    };
    expect(await loadChat(broken, 'u1', NOW)).toEqual([]);
    await expect(saveChat(broken, 'u1', [q('x', NOW)], NOW)).resolves.toBeUndefined();
    await expect(clearChat(broken, 'u1')).resolves.toBeUndefined();
    await expect(clearAllChats(broken)).resolves.toBeUndefined();
  });
});

describe('clearing', () => {
  it('clearChat removes one user; clearAllChats removes every chat but nothing else', async () => {
    const store = memoryStore({ 'gullak.auth': 'session', other: 'keep' });
    await saveChat(store, 'u1', [q('a', NOW)], NOW);
    await saveChat(store, 'u2', [q('b', NOW)], NOW);
    await clearChat(store, 'u1');
    expect(store.data.has(chatKey('u1'))).toBe(false);
    expect(store.data.has(chatKey('u2'))).toBe(true);
    await clearAllChats(store);
    expect([...store.data.keys()].sort()).toEqual(['gullak.auth', 'other']);
  });
});
