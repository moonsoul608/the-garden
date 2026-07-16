begin;

-- Active redirects gain explicit provenance. Columns remain nullable because
-- the same table also contains Delete Foundation 410 tombstones and may hold
-- pre-hardening records whose actor cannot be reconstructed honestly.
alter table public.route_redirects
  add column redirect_type text,
  add column reason text,
  add column created_by uuid,
  add constraint route_redirects_redirect_type_valid check (
    redirect_type is null
    or redirect_type in ('slug_migration', 'region_migration', 'content_move')
  ),
  add constraint route_redirects_reason_valid check (
    reason is null
    or (
      reason = btrim(reason)
      and reason <> ''
      and char_length(reason) <= 500
    )
  );

comment on column public.route_redirects.redirect_type is
  'Explicit local-route migration classification; required by create_route_redirect for new 308 records.';
comment on column public.route_redirects.reason is
  'Optional trimmed Keeper-supplied explanation, limited to 500 characters.';
comment on column public.route_redirects.created_by is
  'Authenticated Garden Keeper who created the active redirect; nullable for tombstones and pre-hardening history.';

-- The approved redirect contract is 308-only. Normalize any pre-hardening
-- permanent 301 record before narrowing the existing status constraint.
update public.route_redirects
set status_code = 308
where status_code = 301;

alter table public.route_redirects
  drop constraint route_redirects_status_and_destination,
  add constraint route_redirects_status_and_destination check (
    (status_code = 308 and new_path is not null)
    or (status_code = 410 and new_path is null)
  );

create function public.create_route_redirect(
  p_source_route text,
  p_target_route text,
  p_redirect_type text,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  creation_time timestamptz := statement_timestamp();
  existing_redirect public.route_redirects%rowtype;
  target_route_record public.route_redirects%rowtype;
  source_content public.contents%rowtype;
  target_content public.contents%rowtype;
  created_redirect public.route_redirects%rowtype;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  if p_source_route is null
     or p_source_route !~ '^/(garden|forest|lake|ruins)/[a-z0-9]+(-[a-z0-9]+)*$' then
    raise invalid_parameter_value using message = 'invalid_source_route';
  end if;

  if p_target_route is null
     or p_target_route !~ '^/(garden|forest|lake|ruins)/[a-z0-9]+(-[a-z0-9]+)*$' then
    raise invalid_parameter_value using message = 'invalid_target_route';
  end if;

  if p_redirect_type is null
     or p_redirect_type not in (
       'slug_migration',
       'region_migration',
       'content_move'
     ) then
    raise invalid_parameter_value using message = 'invalid_redirect_type';
  end if;

  if p_reason is not null
     and (
       p_reason <> btrim(p_reason)
       or p_reason = ''
       or char_length(p_reason) > 500
     ) then
    raise invalid_parameter_value using message = 'invalid_redirect_reason';
  end if;

  if p_source_route = p_target_route then
    raise invalid_parameter_value using message = 'self_redirect';
  end if;

  -- All supported mutations use this command, so one transaction advisory
  -- lock makes graph validation and insertion atomic without broad table locks.
  perform pg_advisory_xact_lock(
    hashtext('public.route_redirects.redirect_graph')
  );

  select redirect.*
  into existing_redirect
  from public.route_redirects as redirect
  where redirect.old_path = p_source_route
  for update;

  if found then
    if existing_redirect.status_code = 308
       and existing_redirect.new_path = p_target_route
       and existing_redirect.redirect_type = p_redirect_type
       and existing_redirect.reason is not distinct from p_reason
       and existing_redirect.created_by is not null then
      return jsonb_build_object(
        'redirectId', existing_redirect.id,
        'sourceRoute', existing_redirect.old_path,
        'targetRoute', existing_redirect.new_path,
        'statusCode', existing_redirect.status_code,
        'type', existing_redirect.redirect_type,
        'reason', existing_redirect.reason,
        'createdBy', existing_redirect.created_by,
        'createdAt', existing_redirect.created_at
      );
    end if;

    raise unique_violation using message = 'redirect_conflict';
  end if;

  -- A live content projection reserves its canonical route in every lifecycle.
  -- Draft and Review are permitted sources but remain forbidden targets.
  select candidate.*
  into source_content
  from public.contents as candidate
  where '/' || lower(candidate.region::text) || '/' || candidate.slug =
    p_source_route
  for key share;

  if not found then
    raise no_data_found using message = 'redirect_source_not_reserved';
  end if;

  select redirect.*
  into target_route_record
  from public.route_redirects as redirect
  where redirect.old_path = p_target_route;

  if found then
    if target_route_record.status_code = 410 then
      raise invalid_parameter_value using message = 'redirect_target_deleted';
    end if;

    if target_route_record.new_path = p_source_route then
      raise serialization_failure using message = 'redirect_loop';
    end if;

    raise serialization_failure using message = 'redirect_chain';
  end if;

  -- A source that is already another redirect's target would turn that
  -- existing one-hop redirect into a chain.
  if exists (
    select 1
    from public.route_redirects as redirect
    where redirect.status_code = 308
      and redirect.new_path = p_source_route
  ) then
    raise serialization_failure using message = 'redirect_chain';
  end if;

  select candidate.*
  into target_content
  from public.contents as candidate
  where '/' || lower(candidate.region::text) || '/' || candidate.slug =
    p_target_route
  for key share;

  if not found then
    raise no_data_found using message = 'redirect_target_not_found';
  end if;

  if target_content.lifecycle = 'Draft' then
    raise invalid_parameter_value using message = 'redirect_target_draft';
  end if;

  if target_content.lifecycle = 'Review' then
    raise invalid_parameter_value using message = 'redirect_target_review';
  end if;

  insert into public.route_redirects (
    old_path,
    new_path,
    status_code,
    content_id,
    created_at,
    redirect_type,
    reason,
    created_by
  ) values (
    p_source_route,
    p_target_route,
    308,
    target_content.id,
    creation_time,
    p_redirect_type,
    p_reason,
    actor_id
  )
  returning * into created_redirect;

  return jsonb_build_object(
    'redirectId', created_redirect.id,
    'sourceRoute', created_redirect.old_path,
    'targetRoute', created_redirect.new_path,
    'statusCode', created_redirect.status_code,
    'type', created_redirect.redirect_type,
    'reason', created_redirect.reason,
    'createdBy', created_redirect.created_by,
    'createdAt', created_redirect.created_at
  );
end;
$$;

comment on function public.create_route_redirect(text, text, text, text) is
  'Creates one explicit Keeper-authored local 308 redirect after atomically rejecting self redirects, loops, chains, private targets, deleted targets, and conflicting retries.';

revoke all on function public.create_route_redirect(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_route_redirect(text, text, text, text)
  to authenticated;

-- Redirect graph writes are command-only. Existing RLS remains enabled and no
-- anonymous table read is introduced; a later public resolver must use its own
-- allow-listed boundary.
revoke insert, update, delete on table public.route_redirects
  from authenticated;

commit;
