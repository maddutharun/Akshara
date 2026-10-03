begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

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
        'moderation_audit', 'translation_cache'
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
  not has_table_privilege('authenticated', 'public.translation_cache', 'select'),
  'authenticated clients cannot read cached AI responses directly'
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

select * from finish();
rollback;
