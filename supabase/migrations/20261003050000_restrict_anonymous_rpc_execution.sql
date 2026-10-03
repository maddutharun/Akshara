revoke all on function public.soft_delete_own_comment(uuid) from public, anon;
grant execute on function public.soft_delete_own_comment(uuid) to authenticated;

revoke all on function public.moderate_comment(uuid, text, text) from public, anon;
grant execute on function public.moderate_comment(uuid, text, text) to authenticated;

revoke all on function public.resolve_comment_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_comment_report(uuid, text, text) to authenticated;

revoke all on function public.resolve_comment_appeal(uuid, text, text) from public, anon;
grant execute on function public.resolve_comment_appeal(uuid, text, text) to authenticated;
