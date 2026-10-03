create table public.reader_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reading_language text not null default 'en' check (reading_language in ('en', 'te', 'hi')),
  appearance text not null default 'light' check (appearance in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.reader_preferences enable row level security;

create policy "users manage their own reader preferences"
  on public.reader_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.reader_preferences to authenticated;
