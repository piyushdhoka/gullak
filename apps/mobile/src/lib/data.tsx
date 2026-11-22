// App data: session, transactions, the "Not recognised" SMS inbox, the review queue, and edits.
// Reads and writes Supabase directly (row-level security keeps each account to its own rows);
// new payments arrive over Realtime. Uses sample data when EXPO_PUBLIC_DEMO=1.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import {
  currentSession,
  friendly,
  isDemo,
  onAuthChange,
  restoreSession,
  deleteAccount as apiDeleteAccount,
  signOut as apiSignOut,
  supabase,
  type Session,
} from './api';
import { demoBudgets, demoInbox, demoJarEntries, demoJars, demoTransactions } from './demo';
import type { Jar, JarEntry } from '@gullak/core/jars.ts';
import type { Budget } from './stats';
import type { ReviewItem, SmsMessage, Transaction } from './types';

// Realtime does the work; this is only a safety net for a dropped connection.
const POLL_MS = 120_000;

const TXN_COLUMNS =
  'id, occurred_at, amount, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, sms_id';

interface DataContextValue {
  mode: 'demo' | 'live';
  /** Session restored (or confirmed absent). */
  ready: boolean;
  session: Session | null;
  /** Opened from a password-reset email; the app asks for a new password first. */
  recovering: boolean;
  transactions: Transaction[];
  inbox: SmsMessage[];
  /** Payees nothing could categorise, grouped, biggest first. */
  review: ReviewItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setCategory: (id: string, category: string, applyToPayee: boolean) => Promise<void>;
  resolveReview: (key: string, category: string) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Pick<Transaction, 'note' | 'hidden'>>) => Promise<void>;
  dismissSms: (id: string) => Promise<void>;
  /** Monthly limits per category. */
  budgets: Budget[];
  setBudget: (category: string, monthlyLimit: number | null) => Promise<void>;
  /** Cash or any payment without an SMS. Resolves once saved (throws a readable error otherwise). */
  addManual: (entry: ManualEntry) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Gullak Jars (savings goals) and the money put into them. */
  jars: Jar[];
  jarEntries: JarEntry[];
  addJar: (jar: { name: string; emoji: string | null; target: number; target_date: string | null }) => Promise<string>;
  addToJar: (jarId: string, amount: number, note?: string) => Promise<void>;
  deleteJar: (jarId: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export interface ManualEntry {
  amount: number;
  category: string;
  direction: 'debit' | 'credit';
  payee?: string;
  note?: string;
  occurredAt?: Date;
}

const DataContext = createContext<DataContextValue | null>(null);

function reviewQueue(txns: Transaction[]): ReviewItem[] {
  const groups = new Map<string, ReviewItem>();
  for (const t of txns) {
    if (t.category_source !== 'unknown' || t.hidden || t.direction !== 'debit') continue;
    const key = t.payee_key ?? `txn:${t.id}`;
    const g = groups.get(key) ?? { key, merchant: t.merchant, payee: t.payee, vpa: t.vpa, count: 0, total: 0, last_at: t.occurred_at };
    g.count += 1;
    g.total = Math.round((g.total + t.amount) * 100) / 100;
    if (t.occurred_at > g.last_at) g.last_at = t.occurred_at;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.total - a.total);
}

interface Fetched {
  transactions?: Transaction[];
  inbox?: SmsMessage[];
  budgets?: Budget[];
  jars?: Jar[];
  jarEntries?: JarEntry[];
  error: string | null;
}

async function fetchAll(): Promise<Fetched> {
  const since = new Date();
  since.setMonth(since.getMonth() - 13, 1);
  const [tx, inbox, budgets, jars, jarEntries] = await Promise.all([
    supabase
      .from('transactions')
      .select(TXN_COLUMNS)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(5000),
    supabase
      .from('sms_inbox')
      .select('id, body, received_at, status, reason')
      .eq('status', 'unrecognised')
      .order('received_at', { ascending: false })
      .limit(100),
    supabase.from('budgets').select('category, monthly_limit').order('category'),
    supabase.from('jars').select('id, name, emoji, target, target_date, created_at').eq('archived', false).order('created_at'),
    supabase.from('jar_entries').select('id, jar_id, amount, note, created_at').order('created_at', { ascending: false }).limit(2000),
  ]);
  return {
    // numeric columns can arrive as strings; the app works in numbers.
    transactions: tx.data ? (tx.data as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) })) : undefined,
    inbox: inbox.data ? (inbox.data as SmsMessage[]) : undefined,
    budgets: budgets.data ? (budgets.data as Budget[]).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) })) : undefined,
    jars: jars.data ? (jars.data as Jar[]).map((j) => ({ ...j, target: Number(j.target) })) : undefined,
    jarEntries: jarEntries.data ? (jarEntries.data as JarEntry[]).map((e) => ({ ...e, amount: Number(e.amount) })) : undefined,
    error: tx.error ? friendly(tx.error) : null,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const mode: 'demo' | 'live' = isDemo ? 'demo' : 'live';
  const [ready, setReady] = useState(isDemo);
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => (isDemo ? demoTransactions() : []));
  const [inbox, setInbox] = useState<SmsMessage[]>(() => (isDemo ? demoInbox : []));
  const [budgets, setBudgets] = useState<Budget[]>(() => (isDemo ? demoBudgets : []));
  const [jars, setJars] = useState<Jar[]>(() => (isDemo ? demoJars : []));
  const [jarEntries, setJarEntries] = useState<JarEntry[]>(() => (isDemo ? demoJarEntries : []));
  const [loading, setLoading] = useState(!isDemo);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.userId ?? null;

  // Restore and follow the session.
  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    restoreSession()
      .then((s) => {
        if (!alive) return;
        setSession(s.session);
        setRecovering(s.recovering);
      })
      .finally(() => alive && setReady(true));
    const off = onAuthChange((s) => {
      // Token refreshes keep the same user: don't reload everything for those.
      setSession((prev) => (prev?.userId === s.session?.userId && prev?.email === s.session?.email ? prev : s.session));
      setRecovering(s.recovering);
      if (!s.session) {
        // The next account to sign in starts from a loading state, not the last one's data.
        setLoading(true);
        setTransactions([]);
        setInbox([]);
        setBudgets([]);
        setJars([]);
        setJarEntries([]);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const apply = useCallback((r: Fetched) => {
    setError(r.error);
    if (r.transactions) setTransactions(r.transactions);
    if (r.inbox) setInbox(r.inbox);
    if (r.budgets) setBudgets(r.budgets);
    if (r.jars) setJars(r.jars);
    if (r.jarEntries) setJarEntries(r.jarEntries);
  }, []);

  const load = useCallback(async () => {
    if (isDemo || !currentSession()) return;
    apply(await fetchAll());
  }, [apply]);

  // Bursts of changes (e.g. "apply to all payments from this payee") reload once.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSoon = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      load();
    }, 300);
  }, [load]);

  // Initial load, then live: Realtime pushes new and changed payments; also reload on foreground and on a push.
  useEffect(() => {
    if (isDemo || !userId) return;
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      apply(r);
      setLoading(false);
    });
    const channel = supabase
      .channel(`txns:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jars', filter: `user_id=eq.${userId}` }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jar_entries', filter: `user_id=eq.${userId}` }, loadSoon)
      .subscribe();
    const tick = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    const onSwMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'refresh') load();
    };
    const sw = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    sw?.addEventListener('message', onSwMessage);
    return () => {
      alive = false;
      supabase.removeChannel(channel);
      clearInterval(tick);
      sub.remove();
      sw?.removeEventListener('message', onSwMessage);
    };
  }, [userId, load, loadSoon, apply]);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /** Runs a write; on failure shows the error and reloads so the screen matches the database again. */
  const write = useCallback(
    async (run: () => PromiseLike<{ error: unknown }>) => {
      if (isDemo) return;
      try {
        const { error: e } = await run();
        if (e) throw e;
      } catch (e) {
        setError(friendly(e));
        await load();
      }
    },
    [load],
  );

  const setCategory = useCallback(
    async (id: string, category: string, applyToPayee: boolean) => {
      setTransactions((list) => {
        const payeeKey = list.find((t) => t.id === id)?.payee_key ?? null;
        return list.map((t) =>
          t.id === id || (applyToPayee && payeeKey && t.payee_key === payeeKey) ? { ...t, category, category_source: 'user' as const } : t,
        );
      });
      await write(() => supabase.rpc('set_category', { p_txn: id, p_category: category, p_apply_all: applyToPayee }));
    },
    [write],
  );

  const resolveReview = useCallback(
    async (key: string, category: string) => {
      setTransactions((list) =>
        list.map((t) =>
          (key.startsWith('txn:') ? t.id === key.slice(4) : t.payee_key === key) ? { ...t, category, category_source: 'user' as const } : t,
        ),
      );
      await write(() => supabase.rpc('resolve_review', { p_key: key, p_category: category }));
    },
    [write],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Pick<Transaction, 'note' | 'hidden'>>) => {
      setTransactions((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      await write(() => supabase.from('transactions').update(patch).eq('id', id));
    },
    [write],
  );

  const dismissSms = useCallback(
    async (id: string) => {
      setInbox((list) => list.filter((m) => m.id !== id));
      await write(() => supabase.from('sms_inbox').update({ status: 'dismissed' }).eq('id', id));
    },
    [write],
  );

  const setBudget = useCallback(
    async (category: string, monthlyLimit: number | null) => {
      setBudgets((list) => {
        const rest = list.filter((b) => b.category !== category);
        return monthlyLimit ? [...rest, { category, monthly_limit: monthlyLimit }].sort((a, b) => a.category.localeCompare(b.category)) : rest;
      });
      await write(() =>
        monthlyLimit
          ? supabase.from('budgets').upsert({ category, monthly_limit: monthlyLimit, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' })
          : supabase.from('budgets').delete().eq('category', category),
      );
    },
    [write],
  );

  const addManual = useCallback(
    async (e: ManualEntry) => {
      const occurred = (e.occurredAt ?? new Date()).toISOString();
      if (isDemo) {
        const t: Transaction = {
          id: `demo-${Date.now()}`,
          occurred_at: occurred,
          amount: Math.round(e.amount * 100) / 100,
          direction: e.direction,
          payee: e.payee?.trim() || null,
          payee_key: null,
          merchant: e.payee?.trim() || null,
          vpa: null,
          category: e.category,
          category_source: 'user',
          bank: null,
          account: null,
          upi_ref: null,
          channel: 'cash',
          source: 'manual',
          note: e.note?.trim() || null,
          hidden: false,
          sms_id: null,
        };
        setTransactions((list) => [t, ...list]);
        return;
      }
      const { error: err } = await supabase.rpc('add_manual_transaction', {
        p_amount: e.amount,
        p_category: e.category,
        p_direction: e.direction,
        p_payee: e.payee?.trim() || null,
        p_note: e.note?.trim() || null,
        p_occurred_at: occurred,
        p_channel: 'cash',
      });
      if (err) throw new Error(friendly(err));
      await load();
    },
    [load],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      setTransactions((list) => list.filter((t) => t.id !== id));
      await write(() => supabase.from('transactions').delete().eq('id', id));
    },
    [write],
  );

  const addJar = useCallback(
    async (j: { name: string; emoji: string | null; target: number; target_date: string | null }) => {
      if (isDemo) {
        const id = `demo-jar-${Date.now()}`;
        setJars((list) => [...list, { id, ...j, created_at: new Date().toISOString() }]);
        return id;
      }
      const { data, error: err } = await supabase.from('jars').insert(j).select('id').single();
      if (err) throw new Error(friendly(err));
      await load();
      return data.id as string;
    },
    [load],
  );

  const addToJar = useCallback(
    async (jarId: string, amount: number, note?: string) => {
      const entry: JarEntry = { id: `local-${Date.now()}`, jar_id: jarId, amount, note: note?.trim() || null, created_at: new Date().toISOString() };
      setJarEntries((list) => [entry, ...list]);
      if (isDemo) return;
      const { error: err } = await supabase.from('jar_entries').insert({ jar_id: jarId, amount, note: entry.note });
      if (err) {
        setJarEntries((list) => list.filter((e) => e.id !== entry.id));
        throw new Error(friendly(err));
      }
      await load();
    },
    [load],
  );

  const deleteJar = useCallback(
    async (jarId: string) => {
      setJars((list) => list.filter((j) => j.id !== jarId));
      setJarEntries((list) => list.filter((e) => e.jar_id !== jarId));
      await write(() => supabase.from('jars').delete().eq('id', jarId));
    },
    [write],
  );

  const review = useMemo(() => reviewQueue(transactions), [transactions]);

  const value = useMemo<DataContextValue>(
    () => ({
      mode,
      ready,
      session,
      recovering,
      transactions,
      inbox,
      review,
      loading,
      refreshing,
      error,
      refresh,
      setCategory,
      resolveReview,
      updateTransaction,
      dismissSms,
      budgets,
      setBudget,
      addManual,
      deleteTransaction,
      jars,
      jarEntries,
      addJar,
      addToJar,
      deleteJar,
      signOut: apiSignOut,
      deleteAccount: apiDeleteAccount,
    }),
    [mode, ready, session, recovering, transactions, inbox, review, loading, refreshing, error, refresh, setCategory, resolveReview, updateTransaction, dismissSms, budgets, setBudget, addManual, deleteTransaction, jars, jarEntries, addJar, addToJar, deleteJar],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
