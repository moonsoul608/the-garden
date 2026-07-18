begin;

-- Growth Stage is a growth-domain attribute. Lake Reflections are a
-- collection/reflection domain, where null explicitly means not tracked.
alter table public.contents
  alter column growth_stage drop not null;

alter table public.content_revisions
  alter column growth_stage drop not null;

alter table public.contents
  add constraint contents_growth_stage_applicability check (
    growth_stage is not null
    or (region = 'Lake' and content_type = 'Reflection')
  ) not valid;

alter table public.content_revisions
  add constraint content_revisions_growth_stage_applicability check (
    growth_stage is not null
    or (region = 'Lake' and content_type = 'Reflection')
  ) not valid;

-- Adding the checks as NOT VALID avoids an extended blocking validation scan;
-- validation follows separately and preserves every existing enum value.
alter table public.contents
  validate constraint contents_growth_stage_applicability;

alter table public.content_revisions
  validate constraint content_revisions_growth_stage_applicability;

-- Keep the already-deployed publication RPC aligned with the applicability
-- rule. Stopping optional Lake growth tracking does not create a fake Growth
-- Note whose destination stage would have to be null.
do $migration$
declare
  function_definition text;
  previous_definition text;
begin
  select pg_get_functiondef(
    'public.publish_review_revision(uuid,uuid,bigint)'::regprocedure
  ) into function_definition;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $old$if content.lifecycle = 'Published'
     and revision.growth_stage is distinct from content.growth_stage
     and not exists ($old$,
    $new$if content.lifecycle = 'Published'
     and revision.growth_stage is not null
     and revision.growth_stage is distinct from content.growth_stage
     and not exists ($new$
  );
  if function_definition = previous_definition then
    raise exception 'publish_review_revision applicability patch did not match';
  end if;
  execute function_definition;
end;
$migration$;

-- Update the deployed V1 import boundary: nullable Growth Stage is valid only
-- for Lake Reflections, and those records require no manual resolution proof.
do $migration$
declare
  function_definition text;
  previous_definition text;
begin
  select pg_get_functiondef(
    'public.execute_v1_import(jsonb)'::regprocedure
  ) into function_definition;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $old$       or item->>'growthStage' not in ('Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant')$old$,
    $new$       or (
         item->>'growthStage' is null
         and not (
           item->>'region' = 'Lake'
           and item->>'contentType' = 'Reflection'
         )
       )
       or (
         item->>'growthStage' is not null
         and item->>'growthStage' not in ('Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant')
       )$new$
  );
  if function_definition = previous_definition then
    raise exception 'execute_v1_import applicability patch did not match';
  end if;
  previous_definition := function_definition;
  function_definition := replace(
    function_definition,
    $old$
  if exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    where item->>'legacyId' in (
      'reverse-1999',
      'jung-and-mandala',
      'the-garden',
      'love-love-love',
      'summer-ghost'
    )
      and (
        item->'growthStageResolution' is null
        or item->'growthStageResolution'->>'approvalStatus' <> 'Approved'
        or item->'growthStageResolution'->>'growthStage' <> item->>'growthStage'
        or nullif(btrim(item->'growthStageResolution'->>'resolutionSource'), '') is null
        or nullif(btrim(item->'growthStageResolution'->>'approvedBy'), '') is null
        or nullif(btrim(item->'growthStageResolution'->>'approvedAt'), '') is null
      )
  ) then
    raise check_violation using message = 'growth_stage_approval_required';
  end if;
$old$,
    $new$
$new$
  );
  if function_definition = previous_definition then
    raise exception 'execute_v1_import Lake resolution patch did not match';
  end if;
  execute function_definition;
end;
$migration$;

comment on column public.contents.growth_stage is
  'Nullable only for Lake Reflections; null means not growth-tracked / not applicable.';

comment on column public.content_revisions.growth_stage is
  'Nullable only for Lake Reflections; null means not growth-tracked / not applicable.';

commit;
