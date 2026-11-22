-- Gullak v2: what both apps (Android + iOS PWA) need from the database for the first release.
-- (Dashboard, trend and subscription detection are computed in the shared app code from the
--  transactions the app already loads, so both platforms show identical numbers offline too.)
--   * monthly budgets per category
--   * cash / manual payments (add_manual_transaction)
--   * delete account (delete_my_account)
--   * devices: Web Push (iPhone PWA) and Expo push (Android), replacing push_subscriptions
--   * where each SMS came from (iOS Shortcut, Android app, test)

-- ---------- where an SMS came from ----------
alter table public.sms_inbox
  add column origin text not null default 'shortcut' check (origin in ('shortcut', 'android', 'test'));

-- ---------- manual payments: cash is its own channel ----------
alter table public.transactions drop constraint transactions_channel_check;
alter table public.transactions
  add constraint transactions_channel_check check (channel in ('upi', 'card', 'netbanking', 'atm', 'cash', 'other'));

-- Adds a payment by hand (cash, UPI Lite, anything without an SMS). Returns its id.
create or replace function public.add_manual_transaction(
  p_amount numeric,
  p_category text,
  p_direction text default 'debit',
  p_payee text default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_channel text default 'cash'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'amount must be between 0 and 10 crore';
  end if;
  if not public.valid_category(p_category) then
    raise exception 'unknown category %', p_category;
  end if;
  if p_direction not in ('debit', 'credit') then
    raise exception 'direction must be debit or credit';
  end if;
  if p_occurred_at > now() + interval '1 day' then
    raise exception 'date is in the future';
  end if;
  insert into public.transactions (user_id, occurred_at, amount, direction, payee, merchant, category,
                                   category_source, channel, source, note)
  values (auth.uid(), coalesce(p_occurred_at, now()), round(p_amount, 2), p_direction,
          nullif(btrim(p_payee), ''), nullif(btrim(p_payee), ''), p_category, 'user',
          coalesce(p_channel, 'cash'), 'manual', nullif(btrim(p_note), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------- monthly budgets per category ----------
create table public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (public.valid_category(category)),
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

-- ---------- delete account ----------
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

-- Signed-in users only.
revoke execute on function public.add_manual_transaction(numeric, text, text, text, text, timestamptz, text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.add_manual_transaction(numeric, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- Budgets change on other devices too.
alter publication supabase_realtime add table public.budgets;
