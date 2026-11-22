// Passwords (scrypt), session tokens and capture keys. Only hashes are stored.

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { nowIso, type DB } from './db.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const SESSION_DAYS = 180;

export function createSession(db: DB, userId: string, userAgent: string | null): string {
  const token = randomBytes(32).toString('base64url');
  const now = nowIso();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now,
    now,
    userAgent,
  );
  return token;
}

/** Returns the user id for a valid token and slides its expiry. */
export function userForToken(db: DB, token: string): { id: string; email: string } | null {
  const row = db
    .prepare(
      `SELECT s.token_hash, s.last_seen_at, u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as { token_hash: string; last_seen_at: string; id: string; email: string } | undefined;
  if (!row) return null;
  if (Date.now() - Date.parse(row.last_seen_at) > SESSION_DAYS * 86_400_000) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
  return { id: row.id, email: row.email };
}

export function deleteSession(db: DB, token: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

/** Creates or replaces the user's capture key. The plain key is returned once. */
export function rotateCaptureKey(db: DB, userId: string): string {
  const key = `cap_${randomBytes(24).toString('hex')}`;
  db.prepare(
    `INSERT INTO capture_keys (user_id, key_hash, key_hint, created_at, last_used_at) VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(user_id) DO UPDATE SET key_hash = excluded.key_hash, key_hint = excluded.key_hint,
       created_at = excluded.created_at, last_used_at = NULL`,
  ).run(userId, sha256(key), key.slice(-4), nowIso());
  return key;
}

/**
 * Keys are `cap_` + lowercase hex, so anything else that sneaks in while pasting into the
 * Shortcuts app (auto-capitalised "Cap_", spaces, line breaks, smart quotes) is safe to drop.
 */
export function normaliseCaptureKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function userForCaptureKey(db: DB, raw: string): string | null {
  const key = normaliseCaptureKey(raw);
  const row = db.prepare('SELECT user_id FROM capture_keys WHERE key_hash = ?').get(sha256(key)) as
    | { user_id: string }
    | undefined;
  if (!row) {
    // Log only the shape of the rejected key, never the key itself.
    const hints = (db.prepare('SELECT key_hint FROM capture_keys').all() as { key_hint: string }[]).map((r) => `…${r.key_hint}`);
    console.warn(
      `capture key rejected: got ${key.length} chars ending …${key.slice(-4)}${key.startsWith('cap_') ? '' : ' (missing cap_ prefix)'}; current key(s): ${hints.join(', ') || 'none'}`,
    );
    return null;
  }
  db.prepare('UPDATE capture_keys SET last_used_at = ? WHERE user_id = ?').run(nowIso(), row.user_id);
  return row.user_id;
}

export const newId = () => randomUUID();

/** Simple fixed-window limiter for login attempts. */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  private max: number;
  private windowMs: number;
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }
  allow(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || now > h.reset) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= this.max;
  }
}
