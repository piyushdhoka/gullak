// Gullak's backend is Supabase: Auth for accounts, Postgres (row-level security) for data,
// Edge Functions for SMS capture (`ingest`) and public settings (`config`).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { clearAllChats } from './chat-history';

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
  if (/email not confirmed/i.test(raw)) return 'Confirm your email first: enter the code we sent you.';
  if (/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i.test(raw)) return 'That code is wrong or has expired. Ask for a new one.';
  if (/password should be|weak password/i.test(raw)) return 'Pick a stronger password: at least 8 characters.';
  if (/already registered|already been registered/i.test(raw)) return 'There’s already an account with this email. Sign in instead.';
  if (/rate limit|too many/i.test(raw)) return 'Too many tries. Wait a minute and try again.';
  return raw;
}

/**
 * Where links in Gullak's emails point. Always the public site, never the address the app happens
 * to run on (so a sign-up from a dev build on localhost still gets a working link).
 * Supabase must list it under Auth › URL Configuration › Redirect URLs.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://gullak.sparkstudio.co.in').replace(/\/$/, '');

function siteUrl() {
  return `${SITE_URL}/`;
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

/**
 * The 6-digit code from the sign-up email. Typing the code works everywhere (iPhone Home Screen app,
 * Android app, a laptop); the link in the same email opens in the browser instead of the installed app.
 */
export async function verifySignupCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\D/g, ''), type: 'signup' });
  if (error) throw new Error(friendly(error));
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: siteUrl() } });
  if (error) throw new Error(friendly(error));
}

/** Password reset by code: proves the email, then sets the new password in the same step. */
export async function resetPasswordWithCode(email: string, code: string, password: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\D/g, ''), type: 'recovery' });
  if (error) throw new Error(friendly(error));
  const { error: e2 } = await supabase.auth.updateUser({ password });
  if (e2) throw new Error(friendly(e2));
  set({ recovering: false });
}

/** Permanently deletes the account and everything in it. */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(friendly(error));
  await signOut();
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendly(error));
  set({ recovering: false });
}

export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
  // Gullu's saved chats are personal: none survive a sign-out (or account deletion) on this device.
  if (isBrowser) await clearAllChats(AsyncStorage);
  set({ session: null, recovering: false });
}
