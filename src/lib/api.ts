// Gullak's backend is Supabase: Auth for accounts, Postgres (row-level security) for data,
// Edge Functions for SMS capture (`ingest`) and public settings (`config`).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/** Sample data, no backend. Turn on with EXPO_PUBLIC_DEMO=1. */
export const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';

// Both are public by design: the publishable key only allows what row-level security allows.
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://rupjxysgksruhhlokbvx.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_qyy11ddDslbK37NJ3gYcjg_MeBynlUe';

const isBrowser = Platform.OS !== 'web' || typeof window !== 'undefined';

// Static rendering runs in Node with no storage: keep nothing there.
const storage = isBrowser
  ? AsyncStorage
  : { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage,
    storageKey: 'gullak.auth',
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    // Email confirmation and password-reset links land back on the site with the session in the URL.
    detectSessionInUrl: Platform.OS === 'web' && isBrowser,
  },
});

export function functionUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

/**
 * The address the iOS Shortcut posts each SMS to (the capture key goes after a slash).
 * On the live site it's our own domain, which forwards to the ingest function, so the address
 * never changes even if the backend moves again.
 */
export function ingestUrl(): string | null {
  if (process.env.EXPO_PUBLIC_INGEST_URL) return process.env.EXPO_PUBLIC_INGEST_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !/^(localhost|127\.|\[::1\])/.test(window.location.hostname)) {
    return `${window.location.origin}/ingest`;
  }
  return functionUrl('ingest');
}

export interface Session {
  token: string;
  userId: string;
  email: string;
}

export interface AuthState {
  session: Session | null;
  /** Opened from a password-reset email: ask for a new password before anything else. */
  recovering: boolean;
}

let state: AuthState = { session: null, recovering: false };
const listeners = new Set<(s: AuthState) => void>();

function toSession(s: SupabaseSession | null): Session | null {
  return s ? { token: s.access_token, userId: s.user.id, email: s.user.email ?? '' } : null;
}

function set(next: Partial<AuthState>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

if (!isDemo && isBrowser) {
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'PASSWORD_RECOVERY') set({ session: toSession(s), recovering: true });
    else if (event === 'SIGNED_OUT') set({ session: null, recovering: false });
    else set({ session: toSession(s) });
  });
}

export function onAuthChange(listener: (s: AuthState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function restoreSession(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  // A reset link may already have fired PASSWORD_RECOVERY before anyone listened; keep that.
  state = { ...state, session: toSession(data.session) };
  return state;
}

export function currentSession() {
  return state.session;
}

/** Turns Supabase/network errors into sentences for people. */
export function friendly(error: unknown): string {
  const raw = (error as { message?: string })?.message ?? String(error);
  if (/failed to fetch|network|load failed/i.test(raw)) return 'Can’t reach Gullak. Check your connection.';
  if (/invalid login credentials/i.test(raw)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(raw)) return 'Confirm your email first: open the link we sent you.';
  if (/already registered|already been registered/i.test(raw)) return 'There’s already an account with this email. Sign in instead.';
  if (/rate limit|too many/i.test(raw)) return 'Too many tries. Wait a minute and try again.';
  return raw;
}

function siteUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error));
}

/** Returns true when the account still needs its email confirmed. */
export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } });
  if (error) throw new Error(friendly(error));
  // With confirmations on, Supabase hides whether the email exists: no identities means it does.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('There’s already an account with this email. Sign in instead.');
  }
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
  if (error) throw new Error(friendly(error));
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendly(error));
  set({ recovering: false });
}

export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
  set({ session: null, recovering: false });
}
