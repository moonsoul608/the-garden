-- Run in the Supabase Preview SQL Editor after applying all migrations.
-- Every fixture and redirect mutation is transaction-local and rolled back.
begin;

set local statement_timeout = '30s';

do $$
declare
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
    rpc_security_definer,
    rpc_volatility,
    rpc_result,
    rpc_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_route_redirect'
    and procedure.pronargs = 4;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 'v'
     or rpc_result <> 'jsonb'
     or rpc_config is null
     or not ('search_path=pg_catalog' = any(rpc_config)) then
    raise exception 'Phase 04D-3C test failed: redirect RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.create_route_redirect(text,text,text,text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.create_route_redirect(text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D-3C test failed: redirect RPC grants are broader or narrower than intended';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'public.route_redirects', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.route_redirects', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.route_redirects', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'anon', 'public.route_redirects', 'SELECT'
     ) then
    raise exception 'Phase 04D-3C test failed: direct redirect access remains exposed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'route_redirects'
      and relation.relrowsecurity
  ) then
    raise exception 'Phase 04D-3C test failed: redirect RLS was weakened';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as relation
      on relation.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'route_redirects'
      and constraint_record.conname =
        'route_redirects_status_and_destination'
      and pg_catalog.pg_get_constraintdef(constraint_record.oid)
        not ilike '%301%'
      and pg_catalog.pg_get_constraintdef(constraint_record.oid)
        ilike '%308%'
      and pg_catalog.pg_get_constraintdef(constraint_record.oid)
        ilike '%410%'
  ) then
    raise exception 'Phase 04D-3C test failed: 308/410 status contract is missing';
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
    '00000000-0000-4000-8000-000000004a31',
    'authenticated',
    'authenticated',
    'keeper-04d-3c@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-3c-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a32',
    'authenticated',
    'authenticated',
    'non-keeper-04d-3c@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-3c-non-keeper"}'::jsonb,
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
    '00000000-0000-4000-8000-000000004a41',
    'github-phase-04d-3c-keeper',
    '00000000-0000-4000-8000-000000004a31',
    '{"sub":"github-phase-04d-3c-keeper","user_name":"phase-04d-3c-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a42',
    'github-phase-04d-3c-non-keeper',
    '00000000-0000-4000-8000-000000004a32',
    '{"sub":"github-phase-04d-3c-non-keeper","user_name":"phase-04d-3c-non-keeper"}'::jsonb,
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
values (
  '00000000-0000-4000-8000-000000004a31',
  'github',
  'github-phase-04d-3c-keeper',
  'phase-04d-3c-keeper'
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
values
  ('00000000-0000-4000-8000-000000004b31', 'redirect-old', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Redirect old', 'en'),
  ('00000000-0000-4000-8000-000000004b32', 'redirect-new', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Redirect new', 'en'),
  ('00000000-0000-4000-8000-000000004b33', 'redirect-other', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Redirect other', 'en'),
  ('00000000-0000-4000-8000-000000004b34', 'loop-a', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Loop A', 'en'),
  ('00000000-0000-4000-8000-000000004b35', 'loop-b', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Loop B', 'en'),
  ('00000000-0000-4000-8000-000000004b36', 'chain-a', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Chain A', 'en'),
  ('00000000-0000-4000-8000-000000004b37', 'chain-b', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Chain B', 'en'),
  ('00000000-0000-4000-8000-000000004b38', 'chain-c', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Chain C', 'en'),
  ('00000000-0000-4000-8000-000000004b39', 'private-source', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Private source', 'en'),
  ('00000000-0000-4000-8000-000000004b3a', 'draft-target', 'Garden', 'Seed', 'short', 'Draft', 'Seed', 'Draft target', 'en'),
  ('00000000-0000-4000-8000-000000004b3b', 'review-target', 'Garden', 'Seed', 'short', 'Review', 'Seed', 'Review target', 'en'),
  ('00000000-0000-4000-8000-000000004b3c', 'deleted-source', 'Garden', 'Seed', 'short', 'Published', 'Seed', 'Deleted source', 'en');

insert into public.route_redirects (
  old_path,
  new_path,
  status_code,
  created_at,
  tombstone_original_content_id,
  tombstone_operation_id,
  tombstoned_at
)
values (
  '/garden/deleted-target',
  null,
  410,
  '2026-07-16 08:00:00+00',
  '00000000-0000-4000-8000-000000004b3d',
  '00000000-0000-4000-8000-000000004e31',
  '2026-07-16 08:00:00+00'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a32","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a32',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.create_route_redirect(
      '/garden/redirect-old',
      '/garden/redirect-new',
      'slug_migration',
      'Keeper authorization test'
    );
  exception
    when insufficient_privilege then
      rejected := sqlerrm = 'garden_keeper_required';
  end;

  if not rejected then
    raise exception 'Phase 04D-3C test failed: non-Keeper created a redirect';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a31","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a31',
  true
);
set local role authenticated;

do $$
declare
  created jsonb;
  retry jsonb;
  rejected boolean;
begin
  created := public.create_route_redirect(
    '/garden/redirect-old',
    '/garden/redirect-new',
    'slug_migration',
    'Canonical slug correction'
  );
  retry := public.create_route_redirect(
    '/garden/redirect-old',
    '/garden/redirect-new',
    'slug_migration',
    'Canonical slug correction'
  );

  if created is distinct from retry
     or created ->> 'statusCode' <> '308'
     or created ->> 'createdBy' <>
       '00000000-0000-4000-8000-000000004a31' then
    raise exception 'Phase 04D-3C test failed: valid creation or idempotent retry is invalid';
  end if;

  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/redirect-old',
      '/garden/redirect-other',
      'slug_migration',
      'Conflicting target'
    );
  exception
    when unique_violation then
      rejected := sqlerrm = 'redirect_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: conflicting redirect was accepted';
  end if;

  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/redirect-other',
      '/garden/redirect-other',
      'content_move',
      null
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'self_redirect';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: self redirect was accepted';
  end if;

  perform public.create_route_redirect(
    '/garden/loop-a',
    '/garden/loop-b',
    'content_move',
    null
  );
  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/loop-b',
      '/garden/loop-a',
      'content_move',
      null
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'redirect_loop';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: redirect loop was accepted';
  end if;

  perform public.create_route_redirect(
    '/garden/chain-a',
    '/garden/chain-b',
    'content_move',
    null
  );
  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/chain-b',
      '/garden/chain-c',
      'content_move',
      null
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'redirect_chain';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: redirect chain was accepted';
  end if;

  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/private-source',
      '/garden/draft-target',
      'content_move',
      null
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'redirect_target_draft';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: Draft target was accepted';
  end if;

  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/private-source',
      '/garden/review-target',
      'content_move',
      null
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'redirect_target_review';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: Review target was accepted';
  end if;

  rejected := false;
  begin
    perform public.create_route_redirect(
      '/garden/deleted-source',
      '/garden/deleted-target',
      'content_move',
      null
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'redirect_target_deleted';
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: deleted target was accepted';
  end if;

  rejected := false;
  begin
    insert into public.route_redirects (
      old_path,
      new_path,
      status_code
    ) values (
      '/garden/direct-write',
      '/garden/redirect-new',
      308
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-3C test failed: direct redirect insert was accepted';
  end if;
end;
$$;

reset role;

do $$
declare
  redirect public.route_redirects%rowtype;
begin
  select candidate.*
  into redirect
  from public.route_redirects as candidate
  where candidate.old_path = '/garden/redirect-old';

  if not found
     or redirect.new_path <> '/garden/redirect-new'
     or redirect.status_code <> 308
     or redirect.redirect_type <> 'slug_migration'
     or redirect.reason <> 'Canonical slug correction'
     or redirect.created_by <>
       '00000000-0000-4000-8000-000000004a31'
     or redirect.content_id <>
       '00000000-0000-4000-8000-000000004b32' then
    raise exception 'Phase 04D-3C test failed: stored redirect provenance is invalid';
  end if;

  if exists (
    select 1
    from public.route_redirects as candidate
    where candidate.old_path in (
      '/garden/loop-b',
      '/garden/chain-b',
      '/garden/private-source',
      '/garden/deleted-source',
      '/garden/direct-write'
    )
  ) then
    raise exception 'Phase 04D-3C test failed: a rejected command left a redirect row';
  end if;
end;
$$;

rollback;
