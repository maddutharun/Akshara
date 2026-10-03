begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '650e8400-e29b-41d4-a716-446655440001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'highlight-owner-a@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '650e8400-e29b-41d4-a716-446655440002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'highlight-owner-b@test.invalid', '',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

insert into public.sources (id, title, license_status, citation, is_active)
values (
  '650e8400-e29b-41d4-a716-446655440003',
  'Synthetic RLS test fixture',
  'public_domain',
  'Generated test fixture; not a scripture source.',
  true
);

insert into public.texts (id, slug, title_en, source_id, is_active)
values (
  '650e8400-e29b-41d4-a716-446655440004',
  'synthetic-rls-fixture',
  'Synthetic RLS fixture',
  '650e8400-e29b-41d4-a716-446655440003',
  true
);

insert into public.chapters (id, text_id, chapter_number)
values (
  '650e8400-e29b-41d4-a716-446655440005',
  '650e8400-e29b-41d4-a716-446655440004',
  1
);

insert into public.verses (
  id, text_id, chapter_id, verse_number, canon_order,
  devanagari_text, iast_text, search_normalized, source_id, status
) values (
  '650e8400-e29b-41d4-a716-446655440006',
  '650e8400-e29b-41d4-a716-446655440004',
  '650e8400-e29b-41d4-a716-446655440005',
  1, 1, 'synthetic fixture', 'synthetic fixture', 'synthetic fixture',
  '650e8400-e29b-41d4-a716-446655440003', 'published'
);

insert into public.private_highlights (user_id, verse_id, quote)
values
  ('650e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440006', 'owner A fixture'),
  ('650e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440006', 'owner B fixture');

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles', 'sources', 'texts', 'chapters', 'verses',
        'verse_translations', 'bookmarks', 'reading_progress', 'comments',
        'comment_reports', 'user_relationships', 'comment_appeals',
        'moderation_audit', 'translation_cache', 'reader_preferences',
        'translation_usage_daily', 'translation_usage_minutely', 'translation_feedback',
        'private_highlights'
      ])
      and not c.relrowsecurity
  ),
  'RLS is enabled on every planned public table'
);

select ok(
  not has_table_privilege('anon', 'public.translation_cache', 'select'),
  'anonymous clients cannot read cached AI responses directly'
);

select ok(
  has_table_privilege('authenticated', 'public.translation_cache', 'select'),
  'authenticated clients can read cache rows only through row-level policies'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'translation_cache'
      and policyname = 'users may read their own translation cache'
      and qual like '%auth.uid%'
  ),
  'translation cache rows are scoped to the signed-in account'
);

select ok(
  not has_table_privilege('authenticated', 'public.translation_usage_daily', 'select')
  and not has_table_privilege('authenticated', 'public.translation_usage_minutely', 'select'),
  'authenticated clients cannot read or alter internal translation quota counters'
);

select ok(
  has_function_privilege('authenticated', 'public.consume_translation_quota()', 'execute')
  and not has_function_privilege('anon', 'public.consume_translation_quota()', 'execute'),
  'only authenticated callers can use the owner-bound translation quota RPC'
);

select ok(
  has_function_privilege('service_role', 'public.prune_translation_controls()', 'execute')
  and not has_function_privilege('authenticated', 'public.prune_translation_controls()', 'execute'),
  'only the service role can prune expired translation and quota records'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'translation_feedback'
      and policyname = 'users may submit feedback on their own translations'
      and with_check like '%auth.uid%'
      and with_check like '%translation_cache%'
  ),
  'feedback can only be attached to a translation owned by the signed-in account'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'translation_feedback'
      and policyname = 'moderators may read translation feedback'
      and qual like '%is_moderator%'
  ),
  'translation quality reports are visible to moderators'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'),
  'users cannot change their own trust or moderation role'
);

select ok(
  has_function_privilege('authenticated', 'public.moderate_comment(uuid,text,text)', 'execute'),
  'authenticated role can invoke moderator-checked moderation RPC'
);

select ok(
  not has_function_privilege('anon', 'public.moderate_comment(uuid,text,text)', 'execute'),
  'anonymous role cannot invoke comment moderation'
);

select ok(
  has_function_privilege('authenticated', 'public.soft_delete_own_comment(uuid)', 'execute'),
  'authenticated role can invoke owner-checked comment deletion RPC'
);

select ok(
  not has_function_privilege('anon', 'public.soft_delete_own_comment(uuid)', 'execute'),
  'anonymous role cannot invoke comment deletion'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ),
  'comment inserts and moderation changes are published for RLS-filtered realtime subscriptions'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'comments'
      and t.tgname = 'comments_validate_reply_context'
      and not t.tgisinternal
  ),
  'comment replies are constrained to approved comments in the same passage'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
      and policyname = 'approved comments and own/moderator comments are readable'
      and qual like '%user_relationships%'
      and qual like '%private.is_moderator%'
  ),
  'comment visibility is restricted to approved, unmuted posts, own posts, or moderators'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_relationships'
      and policyname = 'users manage their own relationships'
      and qual like '%auth.uid%'
      and with_check like '%auth.uid%'
  ),
  'block and mute controls are private to their actor'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'comment_reports'
      and policyname = 'reporters and moderators may read reports'
      and qual like '%reporter_id%'
      and qual like '%private.is_moderator%'
  ),
  'report status is visible to its reporter and moderators only'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'comment_appeals'
      and policyname = 'appeal authors and moderators may read appeals'
      and qual like '%user_id%'
      and qual like '%private.is_moderator%'
  ),
  'appeal status is visible to its author and moderators only'
);

select ok(
  has_function_privilege('authenticated', 'public.resolve_comment_appeal(uuid,text,text)', 'execute')
  and has_function_privilege('authenticated', 'public.resolve_comment_report(uuid,text,text)', 'execute'),
  'authenticated role can invoke moderator-checked appeal and report RPCs'
);

select ok(
  not has_table_privilege('anon', 'public.private_highlights', 'select')
  and has_table_privilege('authenticated', 'public.private_highlights', 'select')
  and has_table_privilege('authenticated', 'public.private_highlights', 'insert')
  and has_table_privilege('authenticated', 'public.private_highlights', 'delete'),
  'private highlights are inaccessible to anonymous clients and available only through authenticated RLS'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_highlights'
      and policyname = 'users read their own private highlights'
      and qual like '%auth.uid%'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_highlights'
      and policyname = 'users delete their own private highlights'
      and qual like '%auth.uid%'
  ),
  'private highlights can only be read or deleted by their owning account'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_highlights'
      and policyname = 'users create highlights on published verses'
      and with_check like '%auth.uid%'
      and with_check like '%published%'
      and with_check like '%public_domain%'
  ),
  'highlights can only be created by their owner for published rights-cleared verses'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '650e8400-e29b-41d4-a716-446655440001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"650e8400-e29b-41d4-a716-446655440001","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.private_highlights),
  1,
  'a signed-in user can read their own highlight and not another account''s'
);

select lives_ok(
  $$
    insert into public.private_highlights (user_id, verse_id, quote)
    values (
      '650e8400-e29b-41d4-a716-446655440001',
      '650e8400-e29b-41d4-a716-446655440006',
      'owner A live insert'
    )
  $$,
  'a signed-in user can create a highlight for a published cleared verse'
);

select throws_ok(
  $$
    insert into public.private_highlights (user_id, verse_id, quote)
    values (
      '650e8400-e29b-41d4-a716-446655440002',
      '650e8400-e29b-41d4-a716-446655440006',
      'spoofed owner insert'
    )
  $$,
  '42501',
  'users cannot assign a new highlight to another account'
);

select ok(
  not has_table_privilege('authenticated', 'public.private_highlights', 'update'),
  'authenticated users cannot rewrite private highlight ownership or content'
);

select lives_ok(
  $$
    delete from public.private_highlights
    where quote = 'owner A live insert'
  $$,
  'a signed-in user can delete their own highlight'
);

select is(
  (select count(*)::integer from public.private_highlights),
  1,
  'creating and deleting an owned highlight leaves only the original owned row'
);

delete from public.private_highlights
where quote = 'owner B fixture';

select set_config(
  'request.jwt.claim.sub',
  '650e8400-e29b-41d4-a716-446655440002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"650e8400-e29b-41d4-a716-446655440002","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.private_highlights),
  1,
  'a second signed-in user can read their own highlight without seeing the first user''s'
);
reset role;

select ok(
  not has_function_privilege('anon', 'public.resolve_comment_appeal(uuid,text,text)', 'execute'),
  'anonymous role cannot invoke appeal resolution'
);

select ok(
  not has_function_privilege('anon', 'public.resolve_comment_report(uuid,text,text)', 'execute'),
  'anonymous role cannot invoke report resolution'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reader_preferences'
      and policyname = 'users manage their own reader preferences'
      and qual like '%auth.uid%'
      and with_check like '%auth.uid%'
  ),
  'reader preference access is scoped to the authenticated owner'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'verse_translations'
      and policyname = 'human reviewed translations with cleared sources are readable'
      and qual like '%public_domain%'
      and qual like '%permission_granted%'
      and qual like '%commissioned%'
  ),
  'human-reviewed translations are visible only when their source is active and redistribution-cleared'
);

select * from finish();
rollback;
