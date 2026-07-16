begin;

-- Storage objects remain immutable and physically untouched in this phase.
-- This ledger records current database references only; it never duplicates
-- object contents or grants a browser role access to purge operations.
create type public.storage_reference_owner_type as enum (
  'ContentProjection',
  'ContentRevision',
  'ContentVersion'
);

create type public.storage_reference_state as enum (
  'Referenced'
);

create type public.storage_object_lifecycle_state as enum (
  'Referenced',
  'Unreferenced',
  'Quarantine',
  'EligibleForPurge'
);

create type public.storage_quarantine_reason as enum (
  'OrdinaryReplacement',
  'FailedUpload',
  'PermanentContentDeletion'
);

create table public.storage_object_references (
  id uuid primary key default gen_random_uuid(),
  object_path text not null,
  bucket text not null,
  reference_owner_type public.storage_reference_owner_type not null,
  reference_owner_id uuid not null,
  content_id uuid,
  reference_state public.storage_reference_state not null default 'Referenced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_object_references_object_path_not_blank check (
    object_path = btrim(object_path)
    and object_path <> ''
  ),
  constraint storage_object_references_bucket_not_blank check (
    bucket = btrim(bucket)
    and bucket <> ''
  ),
  constraint storage_object_references_owner_key unique (
    bucket,
    object_path,
    reference_owner_type,
    reference_owner_id
  )
);

comment on table public.storage_object_references is
  'Server-maintained current-reference ledger for immutable Storage objects; one row represents one database owner reference.';
comment on column public.storage_object_references.content_id is
  'Original content UUID when applicable. It intentionally has no live contents foreign key so version provenance survives permanent projection deletion.';

create index storage_object_references_object_idx
  on public.storage_object_references (bucket, object_path);
create index storage_object_references_content_idx
  on public.storage_object_references (content_id)
  where content_id is not null;
create index storage_object_references_owner_idx
  on public.storage_object_references (
    reference_owner_type,
    reference_owner_id
  );

-- One registry row describes the reference/quarantine state for a known
-- object identity. Eligibility is still recalculated from authoritative
-- sources at inspection time; this state alone can never authorize a purge.
create table public.storage_object_lifecycles (
  bucket text not null,
  object_path text not null,
  lifecycle_state public.storage_object_lifecycle_state not null,
  last_referenced_at timestamptz,
  unreferenced_at timestamptz,
  quarantine_started_at timestamptz,
  quarantine_until timestamptz,
  quarantine_reason public.storage_quarantine_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, object_path),
  constraint storage_object_lifecycles_bucket_not_blank check (
    bucket = btrim(bucket)
    and bucket <> ''
  ),
  constraint storage_object_lifecycles_object_path_not_blank check (
    object_path = btrim(object_path)
    and object_path <> ''
  ),
  constraint storage_object_lifecycles_state_metadata check (
    (
      lifecycle_state = 'Referenced'
      and last_referenced_at is not null
      and unreferenced_at is null
      and quarantine_started_at is null
      and quarantine_until is null
      and quarantine_reason is null
    )
    or (
      lifecycle_state = 'Unreferenced'
      and unreferenced_at is not null
      and quarantine_started_at is null
      and quarantine_until is null
      and quarantine_reason is null
    )
    or (
      lifecycle_state in ('Quarantine', 'EligibleForPurge')
      and unreferenced_at is not null
      and quarantine_started_at is not null
      and quarantine_until is not null
      and quarantine_reason is not null
    )
  ),
  constraint storage_object_lifecycles_quarantine_order check (
    quarantine_until is null
    or quarantine_started_at is null
    or quarantine_until >= quarantine_started_at
  )
);

comment on table public.storage_object_lifecycles is
  'Server-only reference/quarantine registry. It records no physical deletion and is not a Storage object inventory.';

create index storage_object_lifecycles_quarantine_idx
  on public.storage_object_lifecycles (quarantine_until, bucket, object_path)
  where lifecycle_state in ('Quarantine', 'EligibleForPurge');

-- Neither the Keeper browser session nor anonymous clients can inspect or
-- mutate internal paths through the Data API. Future server repair tooling may
-- read these tables with the service role, but all writes remain function-owned.
revoke all on table
  public.storage_object_references,
  public.storage_object_lifecycles
from public, anon, authenticated;
grant select on table
  public.storage_object_references,
  public.storage_object_lifecycles
to service_role;

alter table public.storage_object_references enable row level security;
alter table public.storage_object_lifecycles enable row level security;

-- Version snapshots currently carry cover paths in both the top-level cover
-- and projection.cover shapes. Return both distinct paths so a malformed or
-- transitional snapshot cannot hide a second reference behind coalesce().
create function private.storage_version_reference_paths(p_snapshot jsonb)
returns table (object_path text)
language sql
immutable
set search_path = pg_catalog
as $$
  select distinct candidate.object_path
  from (
    values
      (nullif(btrim(p_snapshot #>> '{cover,path}'), '')),
      (nullif(btrim(p_snapshot #>> '{projection,cover,path}'), ''))
  ) as candidate(object_path)
  where candidate.object_path is not null;
$$;

revoke all on function private.storage_version_reference_paths(jsonb)
  from public, anon, authenticated;

create function private.register_storage_object_reference(
  p_bucket text,
  p_object_path text,
  p_owner_type public.storage_reference_owner_type,
  p_owner_id uuid,
  p_content_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  reference_time timestamptz := statement_timestamp();
begin
  if p_bucket is null
     or p_bucket <> btrim(p_bucket)
     or p_bucket = ''
     or p_object_path is null
     or p_object_path <> btrim(p_object_path)
     or p_object_path = ''
     or p_owner_type is null
     or p_owner_id is null then
    raise invalid_parameter_value using message = 'storage_reference_invalid';
  end if;

  insert into public.storage_object_references (
    object_path,
    bucket,
    reference_owner_type,
    reference_owner_id,
    content_id,
    reference_state,
    created_at,
    updated_at
  ) values (
    p_object_path,
    p_bucket,
    p_owner_type,
    p_owner_id,
    p_content_id,
    'Referenced',
    reference_time,
    reference_time
  )
  on conflict (
    bucket,
    object_path,
    reference_owner_type,
    reference_owner_id
  ) do update
  set
    content_id = excluded.content_id,
    reference_state = 'Referenced',
    updated_at = reference_time;

  insert into public.storage_object_lifecycles (
    bucket,
    object_path,
    lifecycle_state,
    last_referenced_at,
    created_at,
    updated_at
  ) values (
    p_bucket,
    p_object_path,
    'Referenced',
    reference_time,
    reference_time,
    reference_time
  )
  on conflict (bucket, object_path) do update
  set
    lifecycle_state = 'Referenced',
    last_referenced_at = reference_time,
    unreferenced_at = null,
    quarantine_started_at = null,
    quarantine_until = null,
    quarantine_reason = null,
    updated_at = reference_time;
end;
$$;

revoke all on function private.register_storage_object_reference(
  text,
  text,
  public.storage_reference_owner_type,
  uuid,
  uuid
) from public, anon, authenticated;

-- Ordinary reference loss starts a fresh 30-day quarantine only after the
-- final ledger row disappears. A later reference cancels that quarantine.
create function private.release_storage_object_owner_references(
  p_owner_type public.storage_reference_owner_type,
  p_owner_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  release_time timestamptz := statement_timestamp();
  released record;
begin
  if p_owner_type is null or p_owner_id is null then
    raise invalid_parameter_value using message = 'storage_reference_invalid';
  end if;

  for released in
    delete from public.storage_object_references as reference
    where reference.reference_owner_type = p_owner_type
      and reference.reference_owner_id = p_owner_id
    returning reference.bucket, reference.object_path
  loop
    if not exists (
      select 1
      from public.storage_object_references as remaining
      where remaining.bucket = released.bucket
        and remaining.object_path = released.object_path
    ) then
      -- Unreferenced is the boundary event; quarantine begins in the same
      -- transaction so no object is ever temporarily purge-eligible.
      insert into public.storage_object_lifecycles (
        bucket,
        object_path,
        lifecycle_state,
        unreferenced_at,
        quarantine_started_at,
        quarantine_until,
        quarantine_reason,
        created_at,
        updated_at
      ) values (
        released.bucket,
        released.object_path,
        'Quarantine',
        release_time,
        release_time,
        release_time + interval '30 days',
        'OrdinaryReplacement',
        release_time,
        release_time
      )
      on conflict (bucket, object_path) do update
      set
        lifecycle_state = 'Quarantine',
        unreferenced_at = release_time,
        quarantine_started_at = release_time,
        quarantine_until = release_time + interval '30 days',
        quarantine_reason = 'OrdinaryReplacement',
        updated_at = release_time;
    end if;
  end loop;
end;
$$;

revoke all on function private.release_storage_object_owner_references(
  public.storage_reference_owner_type,
  uuid
) from public, anon, authenticated;

create function private.sync_content_projection_storage_reference()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     or (
       tg_op = 'UPDATE'
       and old.cover_image_path is distinct from new.cover_image_path
     ) then
    perform private.release_storage_object_owner_references(
      'ContentProjection',
      old.id
    );
  end if;

  if tg_op <> 'DELETE'
     and new.cover_image_path is not null
     and (
       tg_op = 'INSERT'
       or old.cover_image_path is distinct from new.cover_image_path
     ) then
    perform private.register_storage_object_reference(
      'cover-images',
      new.cover_image_path,
      'ContentProjection',
      new.id,
      new.id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_content_projection_storage_reference()
  from public, anon, authenticated;

create trigger contents_sync_storage_reference
after insert or update of cover_image_path or delete on public.contents
for each row execute function private.sync_content_projection_storage_reference();

create function private.sync_content_revision_storage_reference()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     or (
       tg_op = 'UPDATE'
       and old.cover_image_path is distinct from new.cover_image_path
     ) then
    perform private.release_storage_object_owner_references(
      'ContentRevision',
      old.id
    );
  end if;

  if tg_op <> 'DELETE'
     and new.cover_image_path is not null
     and (
       tg_op = 'INSERT'
       or old.cover_image_path is distinct from new.cover_image_path
     ) then
    perform private.register_storage_object_reference(
      'cover-images',
      new.cover_image_path,
      'ContentRevision',
      new.id,
      new.content_id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_content_revision_storage_reference()
  from public, anon, authenticated;

create trigger content_revisions_sync_storage_reference
after insert or update of cover_image_path or delete on public.content_revisions
for each row execute function private.sync_content_revision_storage_reference();

create function private.sync_content_version_storage_references()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  version_path record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.release_storage_object_owner_references(
      'ContentVersion',
      old.id
    );
  end if;

  if tg_op <> 'DELETE' then
    for version_path in
      select path.object_path
      from private.storage_version_reference_paths(new.snapshot) as path
    loop
      perform private.register_storage_object_reference(
        'cover-images',
        version_path.object_path,
        'ContentVersion',
        new.id,
        new.content_id
      );
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_content_version_storage_references()
  from public, anon, authenticated;

create trigger content_versions_sync_storage_references
after insert or update of snapshot, content_id or delete on public.content_versions
for each row execute function private.sync_content_version_storage_references();

-- Backfill all currently supported reference owners. Triggers maintain every
-- later publish, Draft/Review cover edit, restore, archive checkpoint, and
-- permanent projection deletion without changing those workflow RPCs.
insert into public.storage_object_references (
  object_path,
  bucket,
  reference_owner_type,
  reference_owner_id,
  content_id,
  reference_state,
  created_at,
  updated_at
)
select
  content.cover_image_path,
  'cover-images',
  'ContentProjection'::public.storage_reference_owner_type,
  content.id,
  content.id,
  'Referenced'::public.storage_reference_state,
  statement_timestamp(),
  statement_timestamp()
from public.contents as content
where content.cover_image_path is not null

union all

select
  revision.cover_image_path,
  'cover-images',
  'ContentRevision'::public.storage_reference_owner_type,
  revision.id,
  revision.content_id,
  'Referenced'::public.storage_reference_state,
  statement_timestamp(),
  statement_timestamp()
from public.content_revisions as revision
where revision.lifecycle in ('Draft', 'Review')
  and revision.cover_image_path is not null

union all

select
  version_path.object_path,
  'cover-images',
  'ContentVersion'::public.storage_reference_owner_type,
  version.id,
  version.content_id,
  'Referenced'::public.storage_reference_state,
  statement_timestamp(),
  statement_timestamp()
from public.content_versions as version
cross join lateral
  private.storage_version_reference_paths(version.snapshot) as version_path
where true
on conflict (
  bucket,
  object_path,
  reference_owner_type,
  reference_owner_id
) do nothing;

insert into public.storage_object_lifecycles (
  bucket,
  object_path,
  lifecycle_state,
  last_referenced_at,
  created_at,
  updated_at
)
select distinct
  reference.bucket,
  reference.object_path,
  'Referenced',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp()
from public.storage_object_references as reference
on conflict (bucket, object_path) do update
set
  lifecycle_state = 'Referenced',
  last_referenced_at = excluded.last_referenced_at,
  unreferenced_at = null,
  quarantine_started_at = null,
  quarantine_until = null,
  quarantine_reason = null,
  updated_at = excluded.updated_at;

-- This authoritative check deliberately consults both the ledger and every
-- source table. A ledger/source mismatch blocks eligibility instead of
-- trusting either side and is later classified by reconciliation tooling.
create function private.storage_object_has_any_reference(
  p_bucket text,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    exists (
      select 1
      from public.storage_object_references as reference
      where reference.bucket = p_bucket
        and reference.object_path = p_object_path
        and reference.reference_state = 'Referenced'
    )
    or exists (
      select 1
      from public.contents as content
      where p_bucket = 'cover-images'
        and content.cover_image_path = p_object_path
    )
    or exists (
      select 1
      from public.content_revisions as revision
      where p_bucket = 'cover-images'
        and revision.lifecycle in ('Draft', 'Review')
        and revision.cover_image_path = p_object_path
    )
    or exists (
      select 1
      from public.content_versions as version
      cross join lateral
        private.storage_version_reference_paths(version.snapshot) as path
      where p_bucket = 'cover-images'
        and path.object_path = p_object_path
    );
$$;

revoke all on function private.storage_object_has_any_reference(text, text)
  from public, anon, authenticated;

-- Failed uploads are registered separately because their grace period is an
-- upload-system decision and must not silently inherit replacement retention.
create function public.quarantine_failed_storage_upload(
  p_bucket text,
  p_object_path text,
  p_grace_period interval
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  quarantine_time timestamptz := statement_timestamp();
begin
  if p_bucket is null
     or p_bucket <> btrim(p_bucket)
     or p_bucket = ''
     or p_object_path is null
     or p_object_path <> btrim(p_object_path)
     or p_object_path = ''
     or p_grace_period is null
     or p_grace_period <= interval '0 seconds' then
    raise invalid_parameter_value using message = 'storage_quarantine_invalid';
  end if;

  if private.storage_object_has_any_reference(p_bucket, p_object_path) then
    raise object_not_in_prerequisite_state
      using message = 'storage_object_still_referenced';
  end if;

  insert into public.storage_object_lifecycles (
    bucket,
    object_path,
    lifecycle_state,
    unreferenced_at,
    quarantine_started_at,
    quarantine_until,
    quarantine_reason,
    created_at,
    updated_at
  ) values (
    p_bucket,
    p_object_path,
    'Quarantine',
    quarantine_time,
    quarantine_time,
    quarantine_time + p_grace_period,
    'FailedUpload',
    quarantine_time,
    quarantine_time
  )
  on conflict (bucket, object_path) do update
  set
    lifecycle_state = 'Quarantine',
    unreferenced_at = quarantine_time,
    quarantine_started_at = quarantine_time,
    quarantine_until = quarantine_time + p_grace_period,
    quarantine_reason = 'FailedUpload',
    updated_at = quarantine_time;

  return jsonb_build_object(
    'bucket', p_bucket,
    'objectPath', p_object_path,
    'lifecycleState', 'Quarantine',
    'quarantineReason', 'FailedUpload',
    'quarantineUntil', quarantine_time + p_grace_period
  );
end;
$$;

comment on function public.quarantine_failed_storage_upload(
  text,
  text,
  interval
) is
  'Service-role-only contract that starts a caller-supplied failed-upload grace period without deleting the object.';

revoke all on function public.quarantine_failed_storage_upload(
  text,
  text,
  interval
) from public, anon, authenticated;
grant execute on function public.quarantine_failed_storage_upload(
  text,
  text,
  interval
) to service_role;

-- This explicit bypass marker is safe only in a separate transaction after a
-- permanent content deletion commits. It still refuses all tracked, current
-- projection, active revision, and immutable version references.
create function public.mark_storage_object_post_delete_bypass(
  p_bucket text,
  p_object_path text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  quarantine_time timestamptz := statement_timestamp();
begin
  if p_bucket is null
     or p_bucket <> btrim(p_bucket)
     or p_bucket = ''
     or p_object_path is null
     or p_object_path <> btrim(p_object_path)
     or p_object_path = '' then
    raise invalid_parameter_value using message = 'storage_quarantine_invalid';
  end if;

  if private.storage_object_has_any_reference(p_bucket, p_object_path) then
    raise object_not_in_prerequisite_state
      using message = 'storage_object_still_referenced';
  end if;

  insert into public.storage_object_lifecycles as existing_lifecycle (
    bucket,
    object_path,
    lifecycle_state,
    unreferenced_at,
    quarantine_started_at,
    quarantine_until,
    quarantine_reason,
    created_at,
    updated_at
  ) values (
    p_bucket,
    p_object_path,
    'EligibleForPurge',
    quarantine_time,
    quarantine_time,
    quarantine_time,
    'PermanentContentDeletion',
    quarantine_time,
    quarantine_time
  )
  on conflict (bucket, object_path) do update
  set
    lifecycle_state = 'EligibleForPurge',
    unreferenced_at = coalesce(
      existing_lifecycle.unreferenced_at,
      quarantine_time
    ),
    quarantine_started_at = quarantine_time,
    quarantine_until = quarantine_time,
    quarantine_reason = 'PermanentContentDeletion',
    updated_at = quarantine_time;

  return jsonb_build_object(
    'bucket', p_bucket,
    'objectPath', p_object_path,
    'lifecycleState', 'EligibleForPurge',
    'quarantineReason', 'PermanentContentDeletion',
    'quarantineUntil', quarantine_time
  );
end;
$$;

comment on function public.mark_storage_object_post_delete_bypass(text, text) is
  'Service-role-only post-commit marker for an explicitly deleted content object; it never deletes Storage data and fails if any reference remains.';

revoke all on function public.mark_storage_object_post_delete_bypass(text, text)
  from public, anon, authenticated;
grant execute on function public.mark_storage_object_post_delete_bypass(
  text,
  text
) to service_role;

-- Final purge inspection fails closed. It verifies the ledger, current
-- projection, active Draft/Review workspaces, every immutable version shape,
-- registry presence, and elapsed quarantine. It performs no Storage mutation.
create function public.inspect_storage_object_purge_safety(
  p_bucket text,
  p_object_path text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  inspection_time timestamptz := statement_timestamp();
  lifecycle public.storage_object_lifecycles%rowtype;
  tracked_reference_count integer;
  projection_reference_count integer;
  active_revision_reference_count integer;
  version_reference_count integer;
  blocking_reasons text[] := '{}';
  effective_state text;
begin
  if p_bucket is null
     or p_bucket <> btrim(p_bucket)
     or p_bucket = ''
     or p_object_path is null
     or p_object_path <> btrim(p_object_path)
     or p_object_path = '' then
    raise invalid_parameter_value using message = 'storage_purge_identity_invalid';
  end if;

  select count(*)
  into tracked_reference_count
  from public.storage_object_references as reference
  where reference.bucket = p_bucket
    and reference.object_path = p_object_path
    and reference.reference_state = 'Referenced';

  select count(*)
  into projection_reference_count
  from public.contents as content
  where p_bucket = 'cover-images'
    and content.cover_image_path = p_object_path;

  select count(*)
  into active_revision_reference_count
  from public.content_revisions as revision
  where p_bucket = 'cover-images'
    and revision.lifecycle in ('Draft', 'Review')
    and revision.cover_image_path = p_object_path;

  select count(distinct version.id)
  into version_reference_count
  from public.content_versions as version
  cross join lateral
    private.storage_version_reference_paths(version.snapshot) as path
  where p_bucket = 'cover-images'
    and path.object_path = p_object_path;

  select registry.*
  into lifecycle
  from public.storage_object_lifecycles as registry
  where registry.bucket = p_bucket
    and registry.object_path = p_object_path;

  if tracked_reference_count > 0 then
    blocking_reasons := array_append(
      blocking_reasons,
      'tracked_reference_present'
    );
  end if;
  if projection_reference_count > 0 then
    blocking_reasons := array_append(
      blocking_reasons,
      'projection_reference_present'
    );
  end if;
  if active_revision_reference_count > 0 then
    blocking_reasons := array_append(
      blocking_reasons,
      'active_revision_reference_present'
    );
  end if;
  if version_reference_count > 0 then
    blocking_reasons := array_append(
      blocking_reasons,
      'version_reference_present'
    );
  end if;

  if lifecycle.bucket is null then
    blocking_reasons := array_append(
      blocking_reasons,
      'lifecycle_record_missing'
    );
    effective_state := null;
  elsif lifecycle.lifecycle_state in ('Referenced', 'Unreferenced') then
    blocking_reasons := array_append(
      blocking_reasons,
      'object_not_quarantined'
    );
    effective_state := lifecycle.lifecycle_state::text;
  elsif lifecycle.quarantine_until is null then
    blocking_reasons := array_append(
      blocking_reasons,
      'quarantine_evidence_missing'
    );
    effective_state := lifecycle.lifecycle_state::text;
  elsif lifecycle.quarantine_until > inspection_time then
    blocking_reasons := array_append(
      blocking_reasons,
      'quarantine_not_elapsed'
    );
    effective_state := 'Quarantine';
  else
    effective_state := 'EligibleForPurge';
  end if;

  return jsonb_build_object(
    'bucket', p_bucket,
    'objectPath', p_object_path,
    'checkedAt', inspection_time,
    'eligible', cardinality(blocking_reasons) = 0,
    'blockingReasons', to_jsonb(blocking_reasons),
    'trackedReferenceCount', tracked_reference_count,
    'projectionReferenceCount', projection_reference_count,
    'activeRevisionReferenceCount', active_revision_reference_count,
    'versionReferenceCount', version_reference_count,
    'lifecycleState', effective_state,
    'quarantineReason', lifecycle.quarantine_reason,
    'quarantineStartedAt', lifecycle.quarantine_started_at,
    'quarantineUntil', lifecycle.quarantine_until
  );
end;
$$;

comment on function public.inspect_storage_object_purge_safety(text, text) is
  'Service-role-only, fail-closed purge evidence contract. It never deletes an object.';

revoke all on function public.inspect_storage_object_purge_safety(text, text)
  from public, anon, authenticated;
grant execute on function public.inspect_storage_object_purge_safety(
  text,
  text
) to service_role;

-- Keep all existing bucket policy definitions unchanged. The Phase 02D
-- Keeper DELETE policy remains present for migration compatibility, but the
-- authenticated/anonymous browser roles no longer hold the table privilege
-- required to reach it. A future purge executor must be server-only.
revoke delete on table storage.objects from public, anon, authenticated;

commit;
