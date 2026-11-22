-- Gullak v2: the backend both apps (Android + iOS PWA) build on.
--   * own categories and monthly budgets
--   * account balances read from bank SMS
--   * devices (web push for the iPhone PWA, Expo push for Android) replacing push_subscriptions
--   * where each SMS came from (iOS Shortcut, Android app, test)
--   * summaries computed in the database: month, trend, recurring payments, balances
--   * CSV-ready export and self-service account deletion
-- Money is spent = every debit that isn't hidden (same rule as the app). Months are in India time.

-- ---------- transactions: balance after payment, free-form tags (trips, projects) ----------
alter table public.transactions
  add column balance numeric(14, 2),
  add column tags text[] not null default '{}';
create index transactions_user_tags on public.transactions using gin (tags);

-- ---------- where an SMS came from ----------
alter table public.sms_inbox
  add column origin text not null default 'shortcut' check (origin in ('shortcut', 'android', 'test'));

-- ---------- own categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  emoji text check (char_length(emoji) <= 8),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.categories enable row level security;
create policy "own categories" on public.categories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.builtin_categories()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['Food', 'Groceries', 'Shopping', 'Transport', 'Travel', 'Bills', 'Entertainment',
               'Health', 'Investments', 'Transfers', 'Cash', 'Income', 'Refund', 'Other'];
$$;

-- A category is valid if it's built in or one of the caller's own (not archived).
create or replace function public.valid_category(c text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select c = any (public.builtin_categories())
    or exists (select 1 from public.categories k where k.user_id = auth.uid() and k.name = c and not k.archived);
$$;

-- Built-in + own categories, in one list for pickers.
create or replace function public.list_categories()
returns table (name text, emoji text, color text, kind text, builtin boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.name, null::text, null::text,
         case when b.name in ('Income', 'Refund') then 'income' else 'expense' end, true
  from unnest(public.builtin_categories()) with ordinality as b(name, ord)
  union all
  select k.name, k.emoji, k.color, k.kind, false
  from public.categories k
  where k.user_id = auth.uid() and not k.archived;
$$;

-- ---------- monthly budgets per category ----------
create table public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.budgets enable row level security;
create policy "own budgets" on public.budgets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- devices: replaces push_subscriptions ----------
alter table public.push_subscriptions rename to devices;
alter policy "own push subscriptions" on public.devices rename to "own devices";
alter index public.push_subscriptions_user rename to devices_user;
alter table public.devices
  add column platform text not null default 'web' check (platform in ('web', 'android', 'ios')),
  add column name text,
  add column expo_token text unique,
  add column last_seen_at timestamptz not null default now(),
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth drop not null,
  add constraint devices_has_push_target check (
    (endpoint is not null and p256dh is not null and auth is not null) or expo_token is not null
  );

-- ---------- balances: latest balance each bank account reported ----------
create or replace view public.account_balances
with (security_invoker = true) as
select distinct on (t.user_id, t.bank, t.account)
  t.user_id, t.bank, t.account, t.balance, t.occurred_at as as_of
from public.transactions t
where t.balance is not null and t.account is not null
order by t.user_id, t.bank, t.account, t.occurred_at desc;

-- ---------- summaries ----------

-- Everything a month screen needs, in one call. p_month is any day in the month.
create or replace function public.month_summary(p_month date default (now() at time zone 'Asia/Kolkata')::date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as m0,
           (date_trunc('month', p_month) + interval '1 month')::date as m1,
           (date_trunc('month', p_month) - interval '1 month')::date as prev0
  ),
  t as (
    select x.*, (x.occurred_at at time zone 'Asia/Kolkata')::date as day
    from public.transactions x, bounds b
    where x.user_id = auth.uid() and not x.hidden
      and (x.occurred_at at time zone 'Asia/Kolkata')::date >= b.m0
      and (x.occurred_at at time zone 'Asia/Kolkata')::date < b.m1
  ),
  debits as (select * from t where direction = 'debit'),
  prev as (
    select coalesce(sum(x.amount), 0) as spent
    from public.transactions x, bounds b
    where x.user_id = auth.uid() and not x.hidden and x.direction = 'debit'
      and (x.occurred_at at time zone 'Asia/Kolkata')::date >= b.prev0
      and (x.occurred_at at time zone 'Asia/Kolkata')::date < b.m0
  ),
  days as (
    select case
      when b.m0 = date_trunc('month', now() at time zone 'Asia/Kolkata')::date
        then extract(day from now() at time zone 'Asia/Kolkata')::int
      else (b.m1 - b.m0) end as n
    from bounds b
  )
  select jsonb_build_object(
    'month', (select m0 from bounds),
    'spent', coalesce((select sum(amount) from debits), 0),
    'received', coalesce((select sum(amount) from t where direction = 'credit'), 0),
    'count', (select count(*) from t),
    'days_counted', (select n from days),
    'avg_per_day', round(coalesce((select sum(amount) from debits), 0) / greatest((select n from days), 1), 2),
    'prev_month_spent', (select spent from prev),
    'needs_review', (select count(*) from debits where category_source = 'unknown'),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'total', total, 'count', n,
                                          'budget', budget) order by total desc)
      from (
        select d.category, sum(d.amount) as total, count(*) as n,
               (select monthly_limit from public.budgets g where g.user_id = auth.uid() and g.category = d.category) as budget
        from debits d group by d.category
      ) c), '[]'::jsonb),
    'top_merchants', coalesce((
      select jsonb_agg(jsonb_build_object('merchant', merchant, 'total', total, 'count', n) order by total desc)
      from (
        select coalesce(merchant, payee, 'Unknown') as merchant, sum(amount) as total, count(*) as n
        from debits group by 1 order by 2 desc limit 10
      ) m), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'spent', total) order by day)
      from (select day, sum(amount) as total from debits group by day) d), '[]'::jsonb)
  );
$$;

-- Spent / received per month for the last p_months months (oldest first), for trend charts and averages.
create or replace function public.spending_trend(p_months integer default 6)
returns table (month date, spent numeric, received numeric, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', now() at time zone 'Asia/Kolkata') - make_interval(months => greatest(least(p_months, 36), 1) - 1),
      date_trunc('month', now() at time zone 'Asia/Kolkata'),
      interval '1 month')::date as month
  )
  select m.month,
         coalesce(sum(t.amount) filter (where t.direction = 'debit'), 0),
         coalesce(sum(t.amount) filter (where t.direction = 'credit'), 0),
         count(t.id)
  from months m
  left join public.transactions t
    on t.user_id = auth.uid() and not t.hidden
   and date_trunc('month', t.occurred_at at time zone 'Asia/Kolkata')::date = m.month
  group by m.month
  order by m.month;
$$;

-- Subscriptions, rent, SIPs, EMIs: the same payee charged a similar amount in 3+ different months.
create or replace function public.recurring_payments()
returns table (payee_key text, merchant text, category text, typical_amount numeric, months bigint,
               last_at timestamptz, next_expected date)
language sql
stable
security invoker
set search_path = ''
as $$
  with d as (
    select t.payee_key, coalesce(t.merchant, t.payee) as merchant, t.category, t.amount, t.occurred_at,
           date_trunc('month', t.occurred_at at time zone 'Asia/Kolkata') as m
    from public.transactions t
    where t.user_id = auth.uid() and t.direction = 'debit' and not t.hidden and t.payee_key is not null
      and t.occurred_at > now() - interval '13 months'
  ),
  g as (
    select payee_key, (array_agg(merchant order by occurred_at desc))[1] as merchant,
           (array_agg(category order by occurred_at desc))[1] as category,
           percentile_cont(0.5) within group (order by amount) as median,
           count(distinct m) as months, max(occurred_at) as last_at,
           avg(extract(day from occurred_at at time zone 'Asia/Kolkata')) as dom
    from d group by payee_key
  )
  select g.payee_key, g.merchant, g.category, round(g.median::numeric, 2), g.months, g.last_at,
         (date_trunc('month', g.last_at at time zone 'Asia/Kolkata') + interval '1 month'
           + make_interval(days => round(g.dom)::int - 1))::date
  from g
  where g.months >= 3
    -- most payments within 15% of the typical amount
    and (select count(*) from d where d.payee_key = g.payee_key and abs(d.amount - g.median) <= g.median * 0.15)
        >= 0.7 * (select count(*) from d where d.payee_key = g.payee_key)
  order by g.median desc;
$$;

-- Flat rows for CSV export (the app turns these into a file).
create or replace function public.export_transactions(p_from date default null, p_to date default null)
returns table (date date, time time, direction text, amount numeric, category text, merchant text, payee text,
               vpa text, bank text, account text, upi_ref text, channel text, note text, tags text, hidden boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select (t.occurred_at at time zone 'Asia/Kolkata')::date, (t.occurred_at at time zone 'Asia/Kolkata')::time(0),
         t.direction, t.amount, t.category, t.merchant, t.payee, t.vpa, t.bank, t.account, t.upi_ref, t.channel,
         t.note, array_to_string(t.tags, ', '), t.hidden
  from public.transactions t
  where t.user_id = auth.uid()
    and (p_from is null or (t.occurred_at at time zone 'Asia/Kolkata')::date >= p_from)
    and (p_to is null or (t.occurred_at at time zone 'Asia/Kolkata')::date <= p_to)
  order by t.occurred_at;
$$;

-- Deletes the caller's account and, through cascades, every row they own.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Lock every function down to signed-in users.
revoke execute on function public.list_categories() from public, anon;
revoke execute on function public.month_summary(date) from public, anon;
revoke execute on function public.spending_trend(integer) from public, anon;
revoke execute on function public.recurring_payments() from public, anon;
revoke execute on function public.export_transactions(date, date) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.list_categories() to authenticated;
grant execute on function public.month_summary(date) to authenticated;
grant execute on function public.spending_trend(integer) to authenticated;
grant execute on function public.recurring_payments() to authenticated;
grant execute on function public.export_transactions(date, date) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- Budgets and categories change on other devices too.
alter publication supabase_realtime add table public.budgets, public.categories;
