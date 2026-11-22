-- Gullak on Supabase: transactions, raw bank SMS, learned payee rules, push subscriptions,
-- per-user capture keys for the iOS Shortcut, and server-only settings (VAPID keys).
-- Every user table has row-level security: a signed-in user only ever sees their own rows.

-- ---------- capture keys (the secret part of each user's capture address) ----------
create table public.capture_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  key_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.capture_keys enable row level security;
create policy "read own capture key" on public.capture_keys
  for select to authenticated using (user_id = (select auth.uid()));

-- Creates or replaces the caller's capture key and returns it once; only a SHA-256 hash is kept.
create or replace function public.create_capture_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  k := 'cap_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.capture_keys (user_id, key_hash, key_hint)
  values (auth.uid(), encode(extensions.digest(k, 'sha256'), 'hex'), right(k, 4))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, key_hint = excluded.key_hint, created_at = now(), last_used_at = null;
  return k;
end;
$$;
revoke execute on function public.create_capture_key() from public, anon;
grant execute on function public.create_capture_key() to authenticated;

-- ---------- raw bank SMS ----------
create table public.sms_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  received_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'parsed', 'duplicate', 'ignored', 'unrecognised', 'dismissed')),
  reason text,
  created_at timestamptz not null default now()
);
create index sms_inbox_user_status on public.sms_inbox (user_id, status, received_at desc);
alter table public.sms_inbox enable row level security;
create policy "read own sms" on public.sms_inbox
  for select to authenticated using (user_id = (select auth.uid()));
create policy "update own sms" on public.sms_inbox
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own sms" on public.sms_inbox
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- transactions ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sms_id uuid references public.sms_inbox (id) on delete set null,
  occurred_at timestamptz not null default now(),
  amount numeric(12, 2) not null check (amount > 0),
  direction text not null check (direction in ('debit', 'credit')),
  payee text,
  payee_key text,
  merchant text,
  vpa text,
  category text not null default 'Other',
  category_source text not null default 'unknown'
    check (category_source in ('user', 'merchant', 'heuristic', 'model', 'unknown')),
  bank text,
  account text,
  upi_ref text,
  channel text not null default 'other' check (channel in ('upi', 'card', 'netbanking', 'atm', 'other')),
  source text not null default 'sms' check (source in ('sms', 'manual')),
  note text,
  hidden boolean not null default false,
  dedupe_key text not null default ('manual:' || gen_random_uuid()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index transactions_user_time on public.transactions (user_id, occurred_at desc);
create index transactions_user_payee on public.transactions (user_id, payee_key);
create index transactions_user_review on public.transactions (user_id, category_source);
alter table public.transactions enable row level security;
create policy "read own transactions" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own transactions" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own transactions" on public.transactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own transactions" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------- learned payee → category rules ----------
create table public.payee_rules (
  user_id uuid not null references auth.users (id) on delete cascade,
  payee_key text not null,
  category text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, payee_key)
);
alter table public.payee_rules enable row level security;
create policy "own payee rules" on public.payee_rules
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.valid_category(c text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select c in ('Food', 'Groceries', 'Shopping', 'Transport', 'Travel', 'Bills', 'Entertainment',
               'Health', 'Investments', 'Transfers', 'Cash', 'Income', 'Refund', 'Other');
$$;

-- Change one payment's category, remember it for the payee, optionally re-apply to past payments.
create or replace function public.set_category(p_txn uuid, p_category text, p_apply_all boolean default false)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pk text;
  changed integer := 0;
begin
  if not public.valid_category(p_category) then
    raise exception 'unknown category %', p_category;
  end if;
  update public.transactions set category = p_category, category_source = 'user'
  where id = p_txn and user_id = auth.uid()
  returning payee_key into pk;
  get diagnostics changed = row_count;
  if pk is not null then
    insert into public.payee_rules (user_id, payee_key, category)
    values (auth.uid(), pk, p_category)
    on conflict (user_id, payee_key) do update set category = excluded.category, updated_at = now();
    if p_apply_all then
      update public.transactions set category = p_category, category_source = 'user'
      where user_id = auth.uid() and payee_key = pk;
      get diagnostics changed = row_count;
    end if;
  end if;
  return changed;
end;
$$;
revoke execute on function public.set_category(uuid, text, boolean) from public, anon;
grant execute on function public.set_category(uuid, text, boolean) to authenticated;

-- One tap in Review: categorise a payee (all its payments, now and later) or a single payment ("txn:<id>").
create or replace function public.resolve_review(p_key text, p_category text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer := 0;
begin
  if not public.valid_category(p_category) then
    raise exception 'unknown category %', p_category;
  end if;
  if p_key like 'txn:%' then
    update public.transactions set category = p_category, category_source = 'user'
    where id = substring(p_key from 5)::uuid and user_id = auth.uid();
  else
    insert into public.payee_rules (user_id, payee_key, category)
    values (auth.uid(), p_key, p_category)
    on conflict (user_id, payee_key) do update set category = excluded.category, updated_at = now();
    update public.transactions set category = p_category, category_source = 'user'
    where user_id = auth.uid() and payee_key = p_key;
  end if;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke execute on function public.resolve_review(text, text) from public, anon;
grant execute on function public.resolve_review(text, text) to authenticated;

-- ---------- Web Push subscriptions ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- server-only settings (VAPID keys etc.) ----------
-- RLS on with no policies: only the service role (Edge Functions) can read or write.
create table public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

-- ---------- realtime: new payments appear in the open app instantly ----------
alter publication supabase_realtime add table public.transactions;
