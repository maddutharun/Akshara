drop policy if exists "human reviewed translations are readable"
  on public.verse_translations;

create policy "human reviewed translations with cleared sources are readable"
  on public.verse_translations for select to anon, authenticated
  using (
    status = 'human_reviewed'
    and source_id is not null
    and exists (
      select 1
      from public.verses v
      where v.id = verse_id
        and v.status = 'published'
    )
    and exists (
      select 1
      from public.sources s
      where s.id = source_id
        and s.is_active
        and s.license_status in ('public_domain', 'permission_granted', 'commissioned')
    )
  );
