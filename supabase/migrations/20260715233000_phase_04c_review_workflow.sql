begin;

-- Review transitions stay on the mutable workspace row. These fields record
-- the latest submission/return actors without creating a version checkpoint.
alter table public.content_revisions
  add column review_submitted_at timestamptz,
  add column review_submitted_by uuid,
  add column returned_to_draft_at timestamptz,
  add column returned_to_draft_by uuid,
  add constraint content_revisions_review_submission_pair check (
    (review_submitted_at is null) = (review_submitted_by is null)
  ),
  add constraint content_revisions_draft_return_pair check (
    (returned_to_draft_at is null) = (returned_to_draft_by is null)
  );

comment on column public.content_revisions.review_submitted_at is
  'Server-recorded timestamp of the latest Draft-to-Review submission.';
comment on column public.content_revisions.review_submitted_by is
  'Authenticated Garden Keeper who made the latest Draft-to-Review submission.';
comment on column public.content_revisions.returned_to_draft_at is
  'Server-recorded timestamp of the latest Review-to-Draft return.';
comment on column public.content_revisions.returned_to_draft_by is
  'Authenticated Garden Keeper who made the latest Review-to-Draft return.';

-- Keep provenance and workflow metadata server-managed. Review rows reject
-- ordinary updates; their only allowed mutation is a metadata-only return to
-- Draft. Draft submission is likewise a metadata-only lifecycle transition.
create or replace function public.set_content_revision_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  transition_time timestamptz := statement_timestamp();
  content_fields_changed boolean;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if tg_op = 'INSERT' then
    new.lifecycle = 'Draft';
    new.created_at = transition_time;
    new.created_by = actor_id;
    new.lock_version = 1;
    new.review_submitted_at = null;
    new.review_submitted_by = null;
    new.returned_to_draft_at = null;
    new.returned_to_draft_by = null;
  else
    content_fields_changed :=
      new.slug is distinct from old.slug
      or new.region is distinct from old.region
      or new.content_type is distinct from old.content_type
      or new.detail_level is distinct from old.detail_level
      or new.growth_stage is distinct from old.growth_stage
      or new.title_zh is distinct from old.title_zh
      or new.title_en is distinct from old.title_en
      or new.summary_zh is distinct from old.summary_zh
      or new.summary_en is distinct from old.summary_en
      or new.body_zh_markdown is distinct from old.body_zh_markdown
      or new.body_en_markdown is distinct from old.body_en_markdown
      or new.content_language is distinct from old.content_language
      or new.primary_categories is distinct from old.primary_categories
      or new.tags is distinct from old.tags
      or new.cover_image_path is distinct from old.cover_image_path
      or new.cover_image_alt_zh is distinct from old.cover_image_alt_zh
      or new.cover_image_alt_en is distinct from old.cover_image_alt_en
      or new.featured is distinct from old.featured
      or new.manual_order is distinct from old.manual_order;

    new.id = old.id;
    new.content_id = old.content_id;
    new.source_version_id = old.source_version_id;
    new.base_content_updated_at = old.base_content_updated_at;
    new.created_at = old.created_at;
    new.created_by = old.created_by;
    new.review_submitted_at = old.review_submitted_at;
    new.review_submitted_by = old.review_submitted_by;
    new.returned_to_draft_at = old.returned_to_draft_at;
    new.returned_to_draft_by = old.returned_to_draft_by;

    if old.lifecycle = 'Draft' and new.lifecycle = 'Draft' then
      null;
    elsif old.lifecycle = 'Draft' and new.lifecycle = 'Review' then
      if content_fields_changed then
        raise invalid_parameter_value using message = 'review_transition_must_not_edit';
      end if;
      new.review_submitted_at = transition_time;
      new.review_submitted_by = actor_id;
    elsif old.lifecycle = 'Review' and new.lifecycle = 'Draft' then
      if content_fields_changed then
        raise invalid_parameter_value using message = 'draft_return_must_not_edit';
      end if;
      new.returned_to_draft_at = transition_time;
      new.returned_to_draft_by = actor_id;
    elsif old.lifecycle = 'Review' and new.lifecycle = 'Review' then
      raise invalid_parameter_value using message = 'review_revision_read_only';
    else
      raise invalid_parameter_value using message = 'invalid_revision_transition';
    end if;

    new.lock_version = old.lock_version + 1;
  end if;

  new.updated_at = transition_time;
  new.updated_by = actor_id;
  return new;
end;
$$;

comment on function public.set_content_revision_audit_fields() is
  'Derives revision audit/workflow metadata, increments optimistic locks, and enforces Review immutability.';

commit;
