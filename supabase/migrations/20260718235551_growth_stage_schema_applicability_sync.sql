begin;

-- Synchronize databases where the historical applicability migration was
-- recorded before these columns were made nullable. Existing rows are left
-- unchanged; validation fails and rolls back if any non-Lake null is present.
alter table public.contents
  alter column growth_stage drop not null;

alter table public.content_revisions
  alter column growth_stage drop not null;

-- Replacing the named checks makes this migration safe for databases both
-- with and without the constraints from the historical migration.
alter table public.contents
  drop constraint if exists contents_growth_stage_applicability;

alter table public.contents
  add constraint contents_growth_stage_applicability check (
    growth_stage is not null
    or (region = 'Lake' and content_type = 'Reflection')
  ) not valid;

alter table public.content_revisions
  drop constraint if exists content_revisions_growth_stage_applicability;

alter table public.content_revisions
  add constraint content_revisions_growth_stage_applicability check (
    growth_stage is not null
    or (region = 'Lake' and content_type = 'Reflection')
  ) not valid;

alter table public.contents
  validate constraint contents_growth_stage_applicability;

alter table public.content_revisions
  validate constraint content_revisions_growth_stage_applicability;

commit;
