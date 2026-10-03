create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader' check (char_length(display_name) between 1 and 80),
  role text not null default 'reader' check (role in ('reader', 'contributor', 'scholar', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_or_translator text,
  edition text,
  publication_year integer,
  license_status text not null check (license_status in ('public_domain', 'permission_granted', 'commissioned', 'review_required', 'restricted')),
  citation text not null,
  source_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (publication_year is null or publication_year between 1 and 3000),
  check (not is_active or license_status in ('public_domain', 'permission_granted', 'commissioned'))
);

create table public.texts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_te text,
  title_hi text,
  description_en text,
  source_id uuid not null references public.sources (id) on delete restrict,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  text_id uuid not null references public.texts (id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  name_en text,
  name_te text,
  name_hi text,
  unique (text_id, chapter_number),
  unique (id, text_id)
);

create table public.verses (
  id uuid primary key default gen_random_uuid(),
  text_id uuid not null references public.texts (id) on delete cascade,
  chapter_id uuid not null,
  verse_number integer not null check (verse_number > 0),
  canon_order integer not null check (canon_order > 0),
  devanagari_text text not null check (char_length(devanagari_text) between 1 and 12000),
  iast_text text not null check (char_length(iast_text) between 1 and 12000),
  search_normalized text not null check (char_length(search_normalized) between 1 and 24000),
  source_id uuid not null references public.sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'flagged', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  unique (chapter_id, verse_number),
  unique (text_id, canon_order),
  unique (id, text_id, chapter_id),
  foreign key (chapter_id, text_id) references public.chapters (id, text_id) on delete cascade
);

create table public.verse_translations (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid not null references public.verses (id) on delete cascade,
  language text not null check (language in ('en', 'te', 'hi')),
  translation_text text not null check (char_length(translation_text) between 1 and 24000),
  mode text not null check (mode in ('literal', 'fluent')),
  status text not null default 'in_review' check (status in ('ai_generated', 'in_review', 'human_reviewed', 'rejected', 'suspended')),
  source_id uuid references public.sources (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  provider text,
  model text,
  prompt_version text,
  source_version text not null check (char_length(source_version) between 1 and 200),
  glossary_version text not null default 'none' check (char_length(glossary_version) between 1 and 120),
  created_at timestamptz not null default now(),
  check (
    (status <> 'human_reviewed')
    or (source_id is not null and reviewed_by is not null and reviewed_at is not null)
  )
);

create index verses_published_text_order_idx on public.verses (text_id, canon_order) where status = 'published';
create index verses_chapter_order_idx on public.verses (chapter_id, verse_number);
create index verses_devanagari_trgm_idx on public.verses using gin (devanagari_text gin_trgm_ops) where status = 'published';
create index verses_iast_trgm_idx on public.verses using gin (iast_text gin_trgm_ops) where status = 'published';
create index verses_normalized_trgm_idx on public.verses using gin (search_normalized gin_trgm_ops) where status = 'published';
create index translations_published_verse_idx on public.verse_translations (verse_id, language, mode) where status = 'human_reviewed';
create index translations_text_trgm_idx on public.verse_translations using gin (translation_text gin_trgm_ops) where status = 'human_reviewed';
create unique index translations_one_reviewed_per_pair_uidx
  on public.verse_translations (verse_id, language, mode) where status = 'human_reviewed';

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_id uuid references public.texts (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  verse_id uuid references public.verses (id) on delete cascade,
  collection_name text not null default 'Saved' check (char_length(collection_name) between 1 and 80),
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(text_id, chapter_id, verse_id) = 1)
);

create unique index bookmarks_user_verse_collection_uidx
  on public.bookmarks (user_id, verse_id, collection_name) where verse_id is not null;
create unique index bookmarks_user_chapter_collection_uidx
  on public.bookmarks (user_id, chapter_id, collection_name) where chapter_id is not null;
create unique index bookmarks_user_text_collection_uidx
  on public.bookmarks (user_id, text_id, collection_name) where text_id is not null;

create table public.reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_id uuid not null references public.texts (id) on delete cascade,
  chapter_id uuid,
  verse_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, text_id),
  foreign key (chapter_id, text_id) references public.chapters (id, text_id) on delete cascade,
  foreign key (verse_id, text_id, chapter_id) references public.verses (id, text_id, chapter_id) on delete cascade
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  text_id uuid not null references public.texts (id) on delete cascade,
  chapter_id uuid,
  verse_id uuid,
  parent_comment_id uuid references public.comments (id) on delete set null,
  body text not null check (char_length(body) between 3 and 6000),
  language text not null check (language in ('en', 'te', 'hi')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'flagged', 'hidden', 'deleted')),
  edited_at timestamptz,
  deleted_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((chapter_id is not null) or (verse_id is not null)),
  foreign key (chapter_id, text_id) references public.chapters (id, text_id) on delete cascade,
  foreign key (verse_id, text_id, chapter_id) references public.verses (id, text_id, chapter_id) on delete cascade
);

create index comments_public_thread_idx on public.comments (verse_id, created_at desc) where status = 'approved' and deleted_at is null;
create index comments_user_idx on public.comments (user_id, created_at desc);

create or replace function private.limit_comment_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into recent_count
  from public.comments c
  where c.user_id = new.user_id
    and c.created_at > now() - interval '1 minute';

  if recent_count >= 5 then
    raise exception 'Comment rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger comments_enforce_user_rate
  before insert on public.comments
  for each row execute function private.limit_comment_rate();

create or replace function private.validate_comment_parent_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_context record;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.text_id, c.chapter_id, c.verse_id
  into parent_context
  from public.comments c
  where c.id = new.parent_comment_id
    and c.deleted_at is null
    and (
      c.status = 'approved'
      or c.user_id = auth.uid()
      or private.is_moderator()
    );

  if not found then
    raise exception 'A reply must reference an active comment on the same passage' using errcode = '23514';
  end if;

  if parent_context.text_id is distinct from new.text_id
    or parent_context.chapter_id is distinct from new.chapter_id
    or parent_context.verse_id is distinct from new.verse_id
  then
    raise exception 'A reply must reference an active comment on the same passage' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger comments_validate_parent_context
  before insert or update of parent_comment_id, text_id, chapter_id, verse_id
  on public.comments
  for each row execute function private.validate_comment_parent_context();

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'misinformation', 'copyright', 'other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create or replace function private.limit_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text, 1));
  select count(*) into recent_count
  from public.comment_reports r
  where r.reporter_id = new.reporter_id
    and r.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Report rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger reports_enforce_user_rate
  before insert on public.comment_reports
  for each row execute function private.limit_report_rate();

create table public.user_relationships (
  actor_user_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('block', 'mute')),
  created_at timestamptz not null default now(),
  primary key (actor_user_id, target_user_id, relationship_type),
  check (actor_user_id <> target_user_id)
);

create table public.comment_appeals (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  appeal_text text not null check (char_length(appeal_text) between 3 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'upheld', 'overturned')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table public.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete restrict,
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('approve', 'flag', 'hide', 'restore', 'delete', 'resolve_report', 'dismiss_report', 'resolve_appeal')),
  reason text not null check (char_length(reason) between 3 and 2000),
  created_at timestamptz not null default now()
);

create table public.translation_cache (
  cache_key text primary key,
  verse_id uuid not null references public.verses (id) on delete cascade,
  language text not null check (language in ('en', 'te', 'hi')),
  mode text not null check (mode in ('literal', 'fluent', 'explanation', 'summary')),
  source_version text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  glossary_version text not null,
  output text not null check (char_length(output) between 1 and 24000),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index translation_cache_expiry_idx on public.translation_cache (expires_at);

create or replace function private.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('moderator', 'admin')
  );
$$;

revoke all on function private.is_moderator() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_moderator() to anon, authenticated;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''), 'Reader')
  );
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'comments' and new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function private.touch_updated_at();

create or replace function public.soft_delete_own_comment(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments
  set body = '[deleted by author]',
      status = 'deleted',
      deleted_at = now(),
      edited_at = now(),
      updated_at = now()
  where id = target_comment_id
    and user_id = auth.uid()
    and status in ('pending', 'approved')
    and deleted_at is null;

  if not found then
    raise exception 'Comment not found or cannot be deleted' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.soft_delete_own_comment(uuid) from public;
grant execute on function public.soft_delete_own_comment(uuid) to authenticated;

create or replace function public.moderate_comment(
  target_comment_id uuid,
  next_status text,
  decision_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  if not private.is_moderator() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  if next_status not in ('approved', 'flagged', 'hidden', 'deleted') then
    raise exception 'Unsupported moderation status' using errcode = '22023';
  end if;

  if char_length(trim(decision_reason)) not between 3 and 2000 then
    raise exception 'A moderation reason between 3 and 2000 characters is required' using errcode = '22023';
  end if;

  audit_action := case next_status
    when 'approved' then 'approve'
    when 'flagged' then 'flag'
    when 'hidden' then 'hide'
    else 'delete'
  end;

  update public.comments
  set status = next_status,
      deleted_at = case when next_status = 'deleted' then now() else null end,
      moderated_by = auth.uid(),
      moderation_reason = trim(decision_reason)
  where id = target_comment_id;

  if not found then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;

  insert into public.moderation_audit (comment_id, moderator_id, action, reason)
  values (target_comment_id, auth.uid(), audit_action, trim(decision_reason));
end;
$$;

revoke all on function public.moderate_comment(uuid, text, text) from public;
grant execute on function public.moderate_comment(uuid, text, text) to authenticated;

create or replace function public.resolve_comment_report(
  target_report_id uuid,
  resolution text,
  decision_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_comment_id uuid;
begin
  if not private.is_moderator() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  if resolution not in ('resolved', 'dismissed') then
    raise exception 'Unsupported report resolution' using errcode = '22023';
  end if;

  if char_length(trim(decision_reason)) not between 3 and 2000 then
    raise exception 'A resolution reason between 3 and 2000 characters is required' using errcode = '22023';
  end if;

  update public.comment_reports
  set status = resolution
  where id = target_report_id
  returning comment_id into target_comment_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  insert into public.moderation_audit (comment_id, moderator_id, action, reason)
  values (
    target_comment_id,
    auth.uid(),
    case resolution when 'resolved' then 'resolve_report' else 'dismiss_report' end,
    trim(decision_reason)
  );
end;
$$;

revoke all on function public.resolve_comment_report(uuid, text, text) from public;
grant execute on function public.resolve_comment_report(uuid, text, text) to authenticated;

create or replace function public.resolve_comment_appeal(
  target_appeal_id uuid,
  resolution text,
  decision_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_comment_id uuid;
begin
  if not private.is_moderator() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  if resolution not in ('upheld', 'overturned') then
    raise exception 'Unsupported appeal resolution' using errcode = '22023';
  end if;

  if char_length(trim(decision_reason)) not between 3 and 2000 then
    raise exception 'A resolution reason between 3 and 2000 characters is required' using errcode = '22023';
  end if;

  update public.comment_appeals
  set status = resolution
  where id = target_appeal_id
  returning comment_id into target_comment_id;

  if not found then
    raise exception 'Appeal not found' using errcode = 'P0002';
  end if;

  insert into public.moderation_audit (comment_id, moderator_id, action, reason)
  values (target_comment_id, auth.uid(), 'resolve_appeal', trim(decision_reason));

  if resolution = 'overturned' then
    update public.comments
    set status = 'approved',
        deleted_at = null,
        moderated_by = auth.uid(),
        moderation_reason = trim(decision_reason)
    where id = target_comment_id
      and status in ('flagged', 'hidden');
  end if;
end;
$$;

revoke all on function public.resolve_comment_appeal(uuid, text, text) from public;
grant execute on function public.resolve_comment_appeal(uuid, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.texts enable row level security;
alter table public.chapters enable row level security;
alter table public.verses enable row level security;
alter table public.verse_translations enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reading_progress enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;
alter table public.user_relationships enable row level security;
alter table public.comment_appeals enable row level security;
alter table public.moderation_audit enable row level security;
alter table public.translation_cache enable row level security;

create policy "active sources are readable"
  on public.sources for select to anon, authenticated
  using (is_active and license_status in ('public_domain', 'permission_granted', 'commissioned'));

create policy "active texts are readable"
  on public.texts for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.sources s
    where s.id = source_id and s.is_active
      and s.license_status in ('public_domain', 'permission_granted', 'commissioned')
  ));

create policy "chapters of active texts are readable"
  on public.chapters for select to anon, authenticated
  using (exists (select 1 from public.texts t where t.id = text_id and t.is_active));

create policy "published verses of active texts are readable"
  on public.verses for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.texts t where t.id = text_id and t.is_active)
    and exists (select 1 from public.sources s where s.id = source_id and s.is_active)
  );

create policy "human reviewed translations are readable"
  on public.verse_translations for select to anon, authenticated
  using (
    status = 'human_reviewed'
    and exists (select 1 from public.verses v where v.id = verse_id and v.status = 'published')
  );

create policy "profile display data is readable"
  on public.profiles for select to anon, authenticated
  using (true);

create policy "users may update their display name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "users may read their bookmarks"
  on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users may save their own bookmarks"
  on public.bookmarks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (verse_id is not null and exists (select 1 from public.verses v where v.id = verse_id and v.status = 'published'))
      or (chapter_id is not null and exists (
        select 1 from public.chapters ch join public.texts t on t.id = ch.text_id
        where ch.id = chapter_id and t.is_active
      ))
      or (text_id is not null and exists (select 1 from public.texts t where t.id = text_id and t.is_active))
    )
  );

create policy "users may edit their own bookmarks"
  on public.bookmarks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      (verse_id is not null and exists (select 1 from public.verses v where v.id = verse_id and v.status = 'published'))
      or (chapter_id is not null and exists (
        select 1 from public.chapters ch join public.texts t on t.id = ch.text_id
        where ch.id = chapter_id and t.is_active
      ))
      or (text_id is not null and exists (select 1 from public.texts t where t.id = text_id and t.is_active))
    )
  );

create policy "users may remove their own bookmarks"
  on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "users may read their progress"
  on public.reading_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users may create their progress"
  on public.reading_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.texts t where t.id = reading_progress.text_id and t.is_active)
    and (
      reading_progress.verse_id is null
      or exists (
        select 1 from public.verses v
        where v.id = reading_progress.verse_id
          and v.text_id = reading_progress.text_id
          and v.chapter_id = reading_progress.chapter_id
          and v.status = 'published'
      )
    )
  );

create policy "users may update their progress"
  on public.reading_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.texts t where t.id = reading_progress.text_id and t.is_active)
    and (
      reading_progress.verse_id is null
      or exists (
        select 1 from public.verses v
        where v.id = reading_progress.verse_id
          and v.text_id = reading_progress.text_id
          and v.chapter_id = reading_progress.chapter_id
          and v.status = 'published'
      )
    )
  );

create policy "approved comments and own/moderator comments are readable"
  on public.comments for select to anon, authenticated
  using (
    (
      status = 'approved'
      and deleted_at is null
      and not exists (
        select 1 from public.user_relationships r
        where r.actor_user_id = (select auth.uid())
          and r.target_user_id = user_id
          and r.relationship_type in ('block', 'mute')
      )
    )
    or user_id = (select auth.uid())
    or (select private.is_moderator())
  );

create policy "authenticated users may submit pending comments"
  on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and moderated_by is null
    and moderation_reason is null
    and deleted_at is null
    and exists (
      select 1 from public.texts t
      join public.sources s on s.id = t.source_id
      where t.id = comments.text_id and t.is_active and s.is_active
        and s.license_status in ('public_domain', 'permission_granted', 'commissioned')
    )
    and (
      (comments.verse_id is null and exists (
        select 1 from public.chapters ch
        where ch.id = comments.chapter_id and ch.text_id = comments.text_id
      ))
      or exists (
        select 1 from public.verses v
        where v.id = comments.verse_id and v.text_id = comments.text_id
          and v.chapter_id = comments.chapter_id and v.status = 'published'
      )
    )
  );

create policy "authors may edit their own visible comments"
  on public.comments for update to authenticated
  using (user_id = (select auth.uid()) and status in ('pending', 'approved') and deleted_at is null)
  with check (user_id = (select auth.uid()) and status in ('pending', 'approved') and deleted_at is null);

create policy "users may create reports"
  on public.comment_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
      where c.id = comment_id
        and c.user_id <> (select auth.uid())
        and c.status = 'approved'
        and c.deleted_at is null
    )
  );

create policy "reporters and moderators may read reports"
  on public.comment_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_moderator()));

create policy "users manage their own relationships"
  on public.user_relationships for all to authenticated
  using (actor_user_id = (select auth.uid()))
  with check (actor_user_id = (select auth.uid()));

create policy "users may submit appeals about their own hidden comments"
  on public.comment_appeals for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = (select auth.uid())
        and c.status in ('flagged', 'hidden')
    )
  );

create policy "appeal authors and moderators may read appeals"
  on public.comment_appeals for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_moderator()));

create policy "moderators may read audit history"
  on public.moderation_audit for select to authenticated
  using ((select private.is_moderator()));

revoke all on public.translation_cache from anon, authenticated;
revoke insert, update, delete on public.moderation_audit from anon, authenticated;
revoke insert, update, delete on public.comment_reports from anon, authenticated;
revoke update, delete on public.comment_appeals from anon, authenticated;
revoke delete on public.comments from anon, authenticated;
revoke insert, update, delete on public.sources, public.texts, public.chapters, public.verses, public.verse_translations from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

grant select on public.sources, public.texts, public.chapters, public.verses, public.verse_translations, public.profiles, public.comments to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update on public.reading_progress to authenticated;
grant insert, update (body) on public.comments to authenticated;
grant select, insert on public.comment_reports to authenticated;
grant select, insert, delete on public.user_relationships to authenticated;
grant select, insert on public.comment_appeals to authenticated;
grant select on public.moderation_audit to authenticated;
grant update on public.comment_reports, public.comment_appeals to service_role;
grant select, insert, update, delete on public.moderation_audit, public.translation_cache to service_role;
