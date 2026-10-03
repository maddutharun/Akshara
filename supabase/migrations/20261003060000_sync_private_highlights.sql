create table public.private_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  verse_id uuid not null references public.verses (id) on delete cascade,
  quote text not null check (char_length(quote) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index private_highlights_user_created_idx
  on public.private_highlights (user_id, created_at desc);

alter table public.private_highlights enable row level security;

create policy "users read their own private highlights"
  on public.private_highlights for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users create highlights on published verses"
  on public.private_highlights for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.verses v
      join public.sources s on s.id = v.source_id
      join public.texts t on t.id = v.text_id
      where v.id = private_highlights.verse_id
        and v.status = 'published'
        and t.is_active
        and s.is_active
        and s.license_status in ('public_domain', 'permission_granted', 'commissioned')
    )
  );

create policy "users delete their own private highlights"
  on public.private_highlights for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.private_highlights from anon, authenticated, public;
grant select, insert, delete on public.private_highlights to authenticated;
