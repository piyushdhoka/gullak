// Gullu's chat history, kept on this device for a rolling 24 hours.
// Android: AsyncStorage (on the phone). iPhone PWA: the same API, backed by the browser's localStorage.
// Nothing is stored on the server. Pure functions over a small storage interface, so they can be tested in Node.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  used?: string[];
  error?: boolean;
  /** Server signature on Gullu's answers; sent back so the server trusts them as history. */
  sig?: string;
  /** When the message was added (ms since epoch). */
  at: number;
}

export interface ChatStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys?(): Promise<readonly string[]>;
}

/** How long a message stays: a rolling 24 hours. */
export const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
/** Most messages kept, so a very chatty day can't grow storage without bound. */
export const CHAT_MAX_MESSAGES = 200;
/** Messages sent to Gullu with each question (the server uses the last 10 too). */
export const CHAT_CONTEXT_MESSAGES = 10;

const PREFIX = 'gullu.chat.';
const VERSION = 1;

export const chatKey = (userId: string) => `${PREFIX}${userId}`;

/**
 * What's worth keeping: no error bubbles (rate limits, offline), nothing older than 24 hours,
 * at most CHAT_MAX_MESSAGES, and never an answer whose question has already expired.
 */
export function pruneChat(messages: ChatMessage[], now: number): ChatMessage[] {
  const kept = messages
    .filter((m) => isMessage(m) && !m.error && now - m.at < CHAT_TTL_MS && m.at <= now + 60_000)
    .slice(-CHAT_MAX_MESSAGES);
  while (kept.length && kept[0].role !== 'user') kept.shift();
  return kept;
}

/** The last few messages to send to the server with a new question (no error bubbles, no extra fields). */
export function contextForServer(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string; sig?: string }[] {
  return messages
    .filter((m) => !m.error)
    .slice(-CHAT_CONTEXT_MESSAGES)
    .map(({ role, content, sig }) => (sig ? { role, content, sig } : { role, content }));
}

export async function loadChat(store: ChatStore, userId: string, now = Date.now()): Promise<ChatMessage[]> {
  try {
    const raw = await store.getItem(chatKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: number; messages?: unknown };
    if (parsed?.v !== VERSION || !Array.isArray(parsed.messages)) return [];
    return pruneChat(parsed.messages as ChatMessage[], now);
  } catch {
    // Unreadable or storage blocked: start fresh rather than break the screen.
    return [];
  }
}

export async function saveChat(store: ChatStore, userId: string, messages: ChatMessage[], now = Date.now()): Promise<void> {
  const kept = pruneChat(messages, now);
  try {
    if (kept.length) await store.setItem(chatKey(userId), JSON.stringify({ v: VERSION, messages: kept }));
    else await store.removeItem(chatKey(userId));
  } catch {
    // Storage full or blocked: the chat still works, it just isn't remembered.
  }
}

export async function clearChat(store: ChatStore, userId: string): Promise<void> {
  await store.removeItem(chatKey(userId)).catch(() => {});
}

/** On sign-out / account deletion: remove every saved chat on this device, whoever it belonged to. */
export async function clearAllChats(store: ChatStore): Promise<void> {
  try {
    const keys = (await store.getAllKeys?.()) ?? [];
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => store.removeItem(k)));
  } catch {
    // Nothing more we can do; signing out must not fail because of this.
  }
}

function isMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false;
  const x = m as ChatMessage;
  return (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string' && typeof x.at === 'number' && Number.isFinite(x.at);
}
