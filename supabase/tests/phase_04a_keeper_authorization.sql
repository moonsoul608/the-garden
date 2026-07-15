-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Every Auth, allow-list, content, and Storage fixture is rolled
-- back at the end of the transaction.
begin;

set local statement_timeout = '30s';

do $$
declare
  helper_security_definer boolean;
  helper_volatility "char";
  helper_result text;
  helper_config text[];
  rpc_security_definer boolean;
  rpc_volatility "char";
  rpc_result text;
  rpc_config text[];
begin
  select
    procedure.prosecdef,
    procedure.provolatile,
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig
  into
    helper_security_definer,
    helper_volatility,
    helper_result,
    helper_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'is_garden_keeper'
    and procedure.pronargs = 0;

  if not found
     or helper_security_definer is distinct from true
     or helper_volatility <> 's'
     or helper_result <> 'boolean'
     or helper_config is null
     or not ('search_path=pg_catalog, private, auth' = any(helper_config)) then
    raise exception 'Phase 04A-2 test failed: private Keeper helper is not fixed and fail-closed';
  end if;

  select
    procedure.prosecdef,
    procedure.provolatile,
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig
  into
    rpc_security_definer,
    rpc_volatility,
    rpc_result,
    rpc_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'current_user_is_garden_keeper'
    and procedure.pronargs = 0;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 's'
     or rpc_result <> 'boolean'
     or rpc_config is null
     or not ('search_path=pg_catalog, private' = any(rpc_config)) then
    raise exception 'Phase 04A-2 test failed: public Keeper RPC is not a safe fixed boolean boundary';
  end if;

  if pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
     or pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
     or pg_catalog.has_table_privilege(
       'anon',
       'private.garden_keeper_identities',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'private.garden_keeper_identities',
       'SELECT'
     ) then
    raise exception 'Phase 04A-2 test failed: Keeper allow-list is exposed to an API role';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.current_user_is_garden_keeper()',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.current_user_is_garden_keeper()',
       'EXECUTE'
     ) then
    raise exception 'Phase 04A-2 test failed: Keeper RPC grants are broader or narrower than intended';
  end if;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000004a01',
    'authenticated',
    'authenticated',
    'keeper-04a2@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"approved-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a02',
    'authenticated',
    'authenticated',
    'non-keeper-04a2@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"approved-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a03',
    'authenticated',
    'authenticated',
    'invalid-provider-04a2@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"email":"keeper-04a2@example.invalid","user_name":"approved-keeper"}'::jsonb,
    now(),
    now()
  );

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000004b01',
    'github-immutable-keeper',
    '00000000-0000-4000-8000-000000004a01',
    '{"sub":"github-immutable-keeper","user_name":"approved-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004b02',
    'github-immutable-non-keeper',
    '00000000-0000-4000-8000-000000004a02',
    '{"sub":"github-immutable-non-keeper","user_name":"approved-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004b03',
    'github-immutable-mismatch',
    '00000000-0000-4000-8000-000000004a03',
    '{"email":"keeper-04a2@example.invalid","sub":"github-immutable-mismatch","user_name":"approved-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  );

insert into private.garden_keeper_identities (
  user_id,
  provider,
  provider_user_id,
  username
)
values
  (
    '00000000-0000-4000-8000-000000004a01',
    'github',
    'github-immutable-keeper',
    'approved-keeper'
  ),
  (
    '00000000-0000-4000-8000-000000004a03',
    'github',
    'github-immutable-expected',
    'approved-keeper'
  );

insert into public.contents (
  id,
  slug,
  region,
  content_type,
  detail_level,
  lifecycle,
  growth_stage,
  title_en,
  content_language
)
values (
  '00000000-0000-4000-8000-000000004c01',
  'phase-04a2-keeper-authorization',
  'Garden',
  'Seed',
  'short',
  'Draft',
  'Seed',
  'Phase 04A-2 Keeper Authorization',
  'en'
);

-- Anonymous visitors cannot call the authenticated-only status RPC.
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
declare
  denied boolean := false;
begin
  begin
    perform public.current_user_is_garden_keeper();
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04A-2 test failed: unauthenticated visitor called the Keeper RPC';
  end if;
end;
$$;

reset role;

-- A linked GitHub user absent from the allow-list remains denied by the RPC,
-- content RLS, private-schema grants, and Storage policies.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a02","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a02',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  denied boolean := false;
begin
  if public.current_user_is_garden_keeper() then
    raise exception 'Phase 04A-2 test failed: non-Keeper authenticated user was authorized';
  end if;

  begin
    update public.contents
    set title_en = 'Unauthorized non-Keeper update'
    where id = '00000000-0000-4000-8000-000000004c01';
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04A-2 test failed: non-Keeper retained direct content UPDATE';
  end if;

  denied := false;
  begin
    execute 'select count(*) from private.garden_keeper_identities';
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04A-2 test failed: non-Keeper read the private allow-list';
  end if;

  denied := false;
  begin
    insert into storage.objects (id, bucket_id, name, metadata)
    values (
      '00000000-0000-4000-8000-000000004d02',
      'cover-images',
      'contents/00000000-0000-4000-8000-000000004c01/non-keeper.webp',
      '{"mimetype":"image/webp","size":1}'::jsonb
    );
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04A-2 test failed: non-Keeper bypassed Storage policies';
  end if;
end;
$$;

reset role;

-- Matching username/email metadata is irrelevant when the immutable GitHub
-- provider ID does not match the private allow-list binding.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a03","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a03',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if public.current_user_is_garden_keeper() then
    raise exception 'Phase 04A-2 test failed: mismatched provider identity was authorized from mutable metadata';
  end if;
end;
$$;

reset role;

-- Only the exact auth.users + auth.identities + private allow-list binding is
-- approved. Existing RLS and Storage policies remain the final enforcement.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a01","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a01',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  affected_count integer;
  denied boolean := false;
  original_title text;
begin
  if not public.current_user_is_garden_keeper() then
    raise exception 'Phase 04A-2 test failed: approved Keeper was denied';
  end if;

  select title_en
  into original_title
  from public.contents
  where id = '00000000-0000-4000-8000-000000004c01';

  begin
    update public.contents
    set title_en = 'Direct Keeper update must fail after Phase 04D'
    where id = '00000000-0000-4000-8000-000000004c01';
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04A-2 test failed: Keeper retained direct content UPDATE after Phase 04D';
  end if;

  if (select title_en from public.contents where id = '00000000-0000-4000-8000-000000004c01')
     is distinct from original_title then
    raise exception 'Phase 04A-2 test failed: denied direct Keeper UPDATE changed the projection';
  end if;

  insert into storage.objects (id, bucket_id, name, metadata)
  values (
    '00000000-0000-4000-8000-000000004d01',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004c01/keeper.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  );

  delete from storage.objects
  where id = '00000000-0000-4000-8000-000000004d01';
  get diagnostics affected_count = row_count;

  if affected_count <> 1 then
    raise exception 'Phase 04A-2 test failed: Keeper Storage delete affected % rows', affected_count;
  end if;
end;
$$;

reset role;

rollback;
