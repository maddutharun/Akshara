create or replace function private.validate_comment_reply_context()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_text_id uuid;
  parent_chapter_id uuid;
  parent_verse_id uuid;
  parent_status text;
  parent_deleted_at timestamptz;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.text_id, c.chapter_id, c.verse_id, c.status, c.deleted_at
    into parent_text_id, parent_chapter_id, parent_verse_id, parent_status, parent_deleted_at
    from public.comments c
    where c.id = new.parent_comment_id;

  if not found
    or parent_text_id is distinct from new.text_id
    or parent_chapter_id is distinct from new.chapter_id
    or parent_verse_id is distinct from new.verse_id
    or parent_status <> 'approved'
    or parent_deleted_at is not null
  then
    raise exception 'Replies must target an approved, visible comment in the same passage'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger comments_validate_reply_context
  before insert or update of text_id, chapter_id, verse_id, parent_comment_id
  on public.comments
  for each row execute function private.validate_comment_reply_context();
