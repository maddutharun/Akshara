alter table public.translation_cache
  add column user_id uuid references auth.users (id) on delete cascade;

alter table public.translation_cache enable row level security;

drop policy if exists "users may read their own translation cache" on public.translation_cache;
create policy "users may read their own translation cache"
  on public.translation_cache for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users may create their own translation cache" on public.translation_cache;
create policy "users may create their own translation cache"
  on public.translation_cache for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users may update their own translation cache" on public.translation_cache;
create policy "users may update their own translation cache"
  on public.translation_cache for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.translation_cache to authenticated;

create table public.translation_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 30),
  primary key (user_id, usage_date)
);

create table public.translation_usage_minutely (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 3),
  primary key (user_id, window_start)
);

alter table public.translation_usage_daily enable row level security;
alter table public.translation_usage_minutely enable row level security;
revoke all on public.translation_usage_daily, public.translation_usage_minutely from anon, authenticated;

create or replace function public.consume_translation_quota()
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_minute_start timestamptz := date_trunc('minute', now());
  v_minute_count integer;
  v_day_count integer;
  v_usage_date date := (now() at time zone 'UTC')::date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.translation_usage_minutely as minute_usage (user_id, window_start, request_count)
  values (v_user_id, v_minute_start, 1)
  on conflict (user_id, window_start) do update
    set request_count = minute_usage.request_count + 1
    where minute_usage.request_count < 3
  returning request_count into v_minute_count;

  if v_minute_count is null then
    return query select false, 0, v_minute_start + interval '1 minute';
    return;
  end if;

  insert into public.translation_usage_daily as daily_usage (user_id, usage_date, request_count)
  values (v_user_id, v_usage_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = daily_usage.request_count + 1
    where daily_usage.request_count < 30
  returning request_count into v_day_count;

  if v_day_count is null then
    return query select false, 0, ((v_usage_date + 1)::timestamp at time zone 'UTC');
    return;
  end if;

  return query select true, 30 - v_day_count, ((v_usage_date + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.consume_translation_quota() from public, anon;
grant execute on function public.consume_translation_quota() to authenticated;

create table public.translation_feedback (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null references public.translation_cache (cache_key) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating text not null check (rating in ('helpful', 'issue')),
  issue_type text check (issue_type is null or issue_type in ('inaccurate', 'misleading', 'terminology', 'other')),
  note text check (note is null or char_length(note) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (user_id, cache_key),
  check ((rating = 'helpful' and issue_type is null) or (rating = 'issue' and issue_type is not null))
);

alter table public.translation_feedback enable row level security;

create policy "users may read their own translation feedback"
  on public.translation_feedback for select to authenticated
  using (user_id = (select auth.uid()));

create policy "moderators may read translation feedback"
  on public.translation_feedback for select to authenticated
  using ((select private.is_moderator()));

create policy "users may submit feedback on their own translations"
  on public.translation_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.translation_cache cache
      where cache.cache_key = translation_feedback.cache_key
        and cache.user_id = (select auth.uid())
    )
  );

create policy "users may update their own translation feedback"
  on public.translation_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.translation_cache cache
      where cache.cache_key = translation_feedback.cache_key
        and cache.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.translation_feedback to authenticated;

create or replace function public.prune_translation_controls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
  v_rows integer;
begin
  delete from public.translation_cache where expires_at <= now();
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;

  delete from public.translation_usage_minutely where window_start < now() - interval '35 days';
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;

  delete from public.translation_usage_daily where usage_date < (now() at time zone 'UTC')::date - 35;
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;

  return v_deleted;
end;
$$;

revoke all on function public.prune_translation_controls() from public, anon, authenticated;
grant execute on function public.prune_translation_controls() to service_role;
