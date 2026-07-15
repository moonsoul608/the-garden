begin;

-- A Keeper row is authoritative only while its immutable provider identity is
-- still linked to the same Supabase Auth user. The readable username remains
-- informational and is deliberately not used as an authorization key.
create or replace function private.is_garden_keeper()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private, auth
as $$
  select exists (
    select 1
    from private.garden_keeper_identities as keeper
    join auth.identities as identity
      on identity.user_id = keeper.user_id
      and identity.provider = keeper.provider
      and identity.provider_id = keeper.provider_user_id
    where keeper.user_id = auth.uid()
      and keeper.provider = 'github'
  );
$$;

comment on function private.is_garden_keeper() is
  'Returns true only when the current Auth user and immutable GitHub identity match the private Keeper allow-list.';

-- PostgREST exposes only this boolean result. It never grants access to or
-- returns rows from the private allow-list.
create function public.current_user_is_garden_keeper()
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

commit;
