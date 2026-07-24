begin;

do $$
begin
  if to_regclass('public.content_revisions') is null then
    raise exception 'phase_04c_repair_missing_table: public.content_revisions';
  end if;

  if to_regclass('public.content_versions') is null then
    raise exception 'phase_04c_repair_missing_table: public.content_versions';
  end if;

end;
$$;

alter table public.content_revisions
  add column if not exists source_version_id uuid,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_submitted_by uuid,
  add column if not exists returned_to_draft_at timestamptz,
  add column if not exists returned_to_draft_by uuid;

do $$
declare
  expected_columns constant text[] := array[
    'source_version_id',
    'review_submitted_at',
    'review_submitted_by',
    'returned_to_draft_at',
    'returned_to_draft_by'
  ];
  column_name text;
  expected_type regtype;
begin
  foreach column_name in array expected_columns loop
    expected_type := case
      when column_name in (
        'source_version_id',
        'review_submitted_by',
        'returned_to_draft_by'
      ) then 'pg_catalog.uuid'::regtype
      else 'timestamp with time zone'::regtype
    end;

    if not exists (
      select 1
      from pg_attribute
      where attrelid = 'public.content_revisions'::regclass
        and attname = column_name
        and atttypid = expected_type
        and not attnotnull
        and not attisdropped
    ) then
      raise exception 'phase_04c_repair_column_contract_mismatch: public.content_revisions.%', column_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'content_versions_id_content_id_key'
      and conrelid = 'public.content_versions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint as constraint_record
      where constraint_record.conname = 'content_versions_id_content_id_key'
        and constraint_record.conrelid = 'public.content_versions'::regclass
        and constraint_record.contype = 'u'
        and (
          select array_agg(attribute.attname order by key_position.ordinality)
          from unnest(constraint_record.conkey) with ordinality as key_position(attnum, ordinality)
          join pg_attribute as attribute
            on attribute.attrelid = constraint_record.conrelid
           and attribute.attnum = key_position.attnum
        ) = array['id', 'content_id']
    ) then
      raise exception 'phase_04c_repair_constraint_contract_mismatch: content_versions_id_content_id_key';
    end if;
  else
    alter table public.content_versions
      add constraint content_versions_id_content_id_key
      unique (id, content_id);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'content_revisions_source_version_fkey'
      and conrelid = 'public.content_revisions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint as constraint_record
      where constraint_record.conname = 'content_revisions_source_version_fkey'
        and constraint_record.conrelid = 'public.content_revisions'::regclass
        and constraint_record.confrelid = 'public.content_versions'::regclass
        and constraint_record.contype = 'f'
        and constraint_record.confdeltype = 'r'
        and (
          select array_agg(attribute.attname order by key_position.ordinality)
          from unnest(constraint_record.conkey) with ordinality as key_position(attnum, ordinality)
          join pg_attribute as attribute
            on attribute.attrelid = constraint_record.conrelid
           and attribute.attnum = key_position.attnum
        ) = array['source_version_id', 'content_id']
        and (
          select array_agg(attribute.attname order by key_position.ordinality)
          from unnest(constraint_record.confkey) with ordinality as key_position(attnum, ordinality)
          join pg_attribute as attribute
            on attribute.attrelid = constraint_record.confrelid
           and attribute.attnum = key_position.attnum
        ) = array['id', 'content_id']
    ) then
      raise exception 'phase_04c_repair_constraint_contract_mismatch: content_revisions_source_version_fkey';
    end if;
  else
    alter table public.content_revisions
      add constraint content_revisions_source_version_fkey
      foreign key (source_version_id, content_id)
      references public.content_versions (id, content_id)
      on delete restrict;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'content_revisions_review_submission_pair'
      and conrelid = 'public.content_revisions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'content_revisions_review_submission_pair'
        and conrelid = 'public.content_revisions'::regclass
        and contype = 'c'
        and regexp_replace(
          lower(pg_get_constraintdef(oid)),
          '\s+',
          ' ',
          'g'
        ) = 'check (((review_submitted_at is null) = (review_submitted_by is null)))'
    ) then
      raise exception 'phase_04c_repair_constraint_contract_mismatch: content_revisions_review_submission_pair';
    end if;
  else
    alter table public.content_revisions
      add constraint content_revisions_review_submission_pair check (
        (review_submitted_at is null) = (review_submitted_by is null)
      );
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'content_revisions_draft_return_pair'
      and conrelid = 'public.content_revisions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'content_revisions_draft_return_pair'
        and conrelid = 'public.content_revisions'::regclass
        and contype = 'c'
        and regexp_replace(
          lower(pg_get_constraintdef(oid)),
          '\s+',
          ' ',
          'g'
        ) = 'check (((returned_to_draft_at is null) = (returned_to_draft_by is null)))'
    ) then
      raise exception 'phase_04c_repair_constraint_contract_mismatch: content_revisions_draft_return_pair';
    end if;
  else
    alter table public.content_revisions
      add constraint content_revisions_draft_return_pair check (
        (returned_to_draft_at is null) = (returned_to_draft_by is null)
      );
  end if;
end;
$$;

comment on column public.content_revisions.source_version_id is
  'Immutable checkpoint cloned by a Draft started from Published or Archived content; null for a newly created Draft or legacy projection without a checkpoint.';
comment on column public.content_revisions.review_submitted_at is
  'Server-recorded timestamp of the latest Draft-to-Review submission.';
comment on column public.content_revisions.review_submitted_by is
  'Authenticated Garden Keeper who made the latest Draft-to-Review submission.';
comment on column public.content_revisions.returned_to_draft_at is
  'Server-recorded timestamp of the latest Review-to-Draft return.';
comment on column public.content_revisions.returned_to_draft_by is
  'Authenticated Garden Keeper who made the latest Review-to-Draft return.';

commit;
