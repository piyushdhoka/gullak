-- Rate limits for the AI features (Gullu chat and "Why this category?").
-- Every AI call costs money and shares one provider key, so each signed-in user gets a small allowance
-- per minute and per day, plus a ceiling across all users per day so a wave of new accounts can't drain the key.
--
-- The limits live inside the function, not in its arguments, so a caller can't pass their own.
-- ai_usage has row-level security on and no policies: only this function (security definer) can read or write it.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ask', 'why')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_kind_time on public.ai_usage (user_id, kind, created_at desc);
create index ai_usage_kind_time on public.ai_usage (kind, created_at desc);
alter table public.ai_usage enable row level security;

-- Records one use of an AI feature by the caller, if they are within their limits.
-- Returns { allowed: bool, reason: 'minute' | 'day' | 'busy' | null, retry_after: seconds }.
create or replace function public.ai_allow(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  per_minute int;
  per_day int;
  global_per_day int;
  used_minute int;
  used_day int;
  used_global int;
  oldest timestamptz;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  case p_kind
    when 'ask' then per_minute := 6;  per_day := 60;  global_per_day := 5000;
    when 'why' then per_minute := 20; per_day := 200; global_per_day := 20000;
    else raise exception 'unknown kind %', p_kind;
  end case;

  -- One request at a time per user and kind, so parallel requests can't all slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_kind, 0));

  -- Old rows are only needed for the daily window.
  delete from public.ai_usage where user_id = uid and created_at < now() - interval '2 days';

  select count(*) into used_minute from public.ai_usage
   where user_id = uid and kind = p_kind and created_at > now() - interval '1 minute';
  if used_minute >= per_minute then
    select min(created_at) into oldest from public.ai_usage
     where user_id = uid and kind = p_kind and created_at > now() - interval '1 minute';
    return jsonb_build_object('allowed', false, 'reason', 'minute',
      'retry_after', greatest(1, ceil(extract(epoch from (oldest + interval '1 minute' - now()))))::int);
  end if;

  select count(*) into used_day from public.ai_usage
   where user_id = uid and kind = p_kind and created_at > now() - interval '1 day';
  if used_day >= per_day then
    select min(created_at) into oldest from public.ai_usage
     where user_id = uid and kind = p_kind and created_at > now() - interval '1 day';
    return jsonb_build_object('allowed', false, 'reason', 'day',
      'retry_after', greatest(60, ceil(extract(epoch from (oldest + interval '1 day' - now()))))::int);
  end if;

  select count(*) into used_global from public.ai_usage
   where kind = p_kind and created_at > now() - interval '1 day';
  if used_global >= global_per_day then
    return jsonb_build_object('allowed', false, 'reason', 'busy', 'retry_after', 3600);
  end if;

  insert into public.ai_usage (user_id, kind) values (uid, p_kind);
  return jsonb_build_object('allowed', true, 'reason', null, 'retry_after', 0);
end;
$$;

revoke all on table public.ai_usage from public, anon, authenticated;
revoke execute on function public.ai_allow(text) from public, anon;
grant execute on function public.ai_allow(text) to authenticated;
