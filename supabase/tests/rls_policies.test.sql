begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

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
        'translation_usage_daily', 'translation_usage_minutely', 'translation_feedback'
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
