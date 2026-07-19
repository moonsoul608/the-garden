begin;

create or replace function public.current_user_is_garden_keeper()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select private.is_garden_keeper();
$$;

comment on function public.current_user_is_garden_keeper() is
  'Returns only the current authenticated user''s Garden Keeper status.';

revoke all on function public.current_user_is_garden_keeper()
  from public, anon, authenticated;

grant execute on function public.current_user_is_garden_keeper()
  to authenticated;

notify pgrst, 'reload schema';

commit;
