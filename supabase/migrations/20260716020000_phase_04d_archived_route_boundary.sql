begin;

create function public.resolve_public_content_route(
  p_region public.garden_region,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  route_content public.contents%rowtype;
  related_targets jsonb;
  route_path text;
begin
  if p_slug is null
    or p_slug <> btrim(p_slug)
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    return jsonb_build_object(
      'disposition', 'not_found',
      'legacyFallback', 'forbidden'
    );
  end if;

  route_path := '/' || lower(p_region::text) || '/' || p_slug;

  -- Existing tombstones reserve an identity, but this boundary does not
  -- resolve redirects or emit a 410 response.
  if exists (
    select 1
    from public.route_redirects as redirect
    where redirect.old_path = route_path
      and redirect.status_code = 410
  ) then
    return jsonb_build_object(
      'disposition', 'not_found',
      'legacyFallback', 'forbidden'
    );
  end if;

  select projection.*
  into route_content
  from public.contents as projection
  where projection.region = p_region
    and projection.slug = p_slug;

  if not found then
    return jsonb_build_object(
      'disposition', 'not_found',
      'legacyFallback', 'allowed'
    );
  end if;

  if route_content.lifecycle = 'Published' then
    return jsonb_build_object('disposition', 'published');
  end if;

  if route_content.lifecycle <> 'Archived' then
    return jsonb_build_object(
      'disposition', 'not_found',
      'legacyFallback', 'forbidden'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'relationType', relation.relation_type,
        'target', jsonb_build_object(
          'slug', target.slug,
          'region', target.region,
          'growthStage', target.growth_stage,
          'title', coalesce(
            nullif(btrim(target.title_zh), ''),
            nullif(btrim(target.title_en), '')
          )
        )
      )
      order by relation.created_at, relation.id
    ),
    '[]'::jsonb
  )
  into related_targets
  from public.content_relations as relation
  join public.contents as target
    on target.id = relation.target_content_id
   and target.lifecycle = 'Published'
  where relation.source_content_id = route_content.id;

  return jsonb_build_object(
    'disposition', 'archived',
    'content', jsonb_build_object(
      'title', coalesce(
        nullif(btrim(route_content.title_zh), ''),
        nullif(btrim(route_content.title_en), '')
      ),
      'region', route_content.region,
      'growthStage', route_content.growth_stage,
      'lifecycle', 'Archived',
      'restingState', 'archived',
      'relations', related_targets
    )
  );
end;
$$;

comment on function public.resolve_public_content_route(
  public.garden_region,
  text
) is
  'Returns a public route disposition, a restricted Archived resting payload, and only an internal legacy-fallback decision for unavailable routes.';

revoke all on function public.resolve_public_content_route(
  public.garden_region,
  text
) from public, anon, authenticated;
grant execute on function public.resolve_public_content_route(
  public.garden_region,
  text
) to anon, authenticated;

create function public.filter_unmigrated_public_routes(p_routes jsonb)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with requested as (
    select
      item.value ->> 'region' as region,
      item.value ->> 'slug' as slug,
      item.ordinality
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_routes) = 'array' then p_routes
        else '[]'::jsonb
      end
    ) with ordinality as item(value, ordinality)
    where item.ordinality <= 128
  ),
  valid as (
    select requested.region, requested.slug, requested.ordinality
    from requested
    where requested.region in ('Garden', 'Forest', 'Lake', 'Ruins')
      and requested.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(valid.region || '/' || valid.slug)
      order by valid.ordinality
    ),
    '[]'::jsonb
  )
  from valid
  where not exists (
    select 1
    from public.contents as projection
    where projection.region::text = valid.region
      and projection.slug = valid.slug
  )
  and not exists (
    select 1
    from public.route_redirects as redirect
    where redirect.old_path = '/' || lower(valid.region) || '/' || valid.slug
      and redirect.status_code = 410
  );
$$;

comment on function public.filter_unmigrated_public_routes(jsonb) is
  'Filters a bounded caller-supplied route list to identities with no database projection or tombstone, preventing dual-read legacy resurrection.';

revoke all on function public.filter_unmigrated_public_routes(jsonb)
  from public, anon, authenticated;
grant execute on function public.filter_unmigrated_public_routes(jsonb)
  to anon, authenticated;

commit;
