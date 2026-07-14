-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Every fixture and setting change is rolled back.
begin;

set local statement_timeout = '30s';

-- Stable, test-only identifiers make policy results easy to isolate from any
-- Preview content that may already exist.
insert into public.contents (
  id,
  slug,
  region,
  content_type,
  detail_level,
  lifecycle,
  growth_stage,
  title_en,
  content_language,
  published_at
)
values
  (
    '00000000-0000-0000-0000-000000002001',
    'phase-02d-published-one',
    'Garden',
    'Seed',
    'full',
    'Published',
    'Growing',
    'Phase 02D Published One',
    'en',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000002002',
    'phase-02d-published-two',
    'Forest',
    'Question',
    'short',
    'Published',
    'Seed',
    'Phase 02D Published Two',
    'en',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000002003',
    'phase-02d-draft',
    'Garden',
    'Seed',
    'full',
    'Draft',
    'Seed',
    'Phase 02D Draft',
    'en',
    null
  ),
  (
    '00000000-0000-0000-0000-000000002004',
    'phase-02d-review',
    'Lake',
    'Reflection',
    'full',
    'Review',
    'Sprout',
    'Phase 02D Review',
    'en',
    null
  ),
  (
    '00000000-0000-0000-0000-000000002005',
    'phase-02d-archived',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Phase 02D Archived',
    'en',
    now()
  );

insert into public.content_versions (
  id,
  content_id,
  snapshot,
  checkpoint_reason
)
values (
  '00000000-0000-0000-0000-000000002101',
  '00000000-0000-0000-0000-000000002003',
  '{"phase":"02d"}'::jsonb,
  'Phase 02D permission test'
);

insert into public.growth_notes (
  id,
  content_id,
  to_stage,
  note_en,
  is_public
)
values
  (
    '00000000-0000-0000-0000-000000002201',
    '00000000-0000-0000-0000-000000002001',
    'Growing',
    'Visible public note',
    true
  ),
  (
    '00000000-0000-0000-0000-000000002202',
    '00000000-0000-0000-0000-000000002001',
    'Growing',
    'Private note on Published content',
    false
  ),
  (
    '00000000-0000-0000-0000-000000002203',
    '00000000-0000-0000-0000-000000002003',
    'Seed',
    'Public flag on Draft content',
    true
  );

insert into public.content_relations (
  id,
  source_content_id,
  target_content_id,
  relation_type
)
values
  (
    '00000000-0000-0000-0000-000000002301',
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002002',
    'relatedTo'
  ),
  (
    '00000000-0000-0000-0000-000000002302',
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002003',
    'relatedTo'
  );

insert into public.tags (id, normalized_name, display_name)
values
  (
    '00000000-0000-0000-0000-000000002401',
    'phase-02d-public-tag',
    'Phase 02D Public Tag'
  ),
  (
    '00000000-0000-0000-0000-000000002402',
    'phase-02d-draft-tag',
    'Phase 02D Draft Tag'
  );

insert into public.content_tags (content_id, tag_id)
values
  (
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002401'
  ),
  (
    '00000000-0000-0000-0000-000000002003',
    '00000000-0000-0000-0000-000000002402'
  );

insert into public.home_curation (content_id, slot, sort_order)
values
  (
    '00000000-0000-0000-0000-000000002001',
    'recentlyPlanted',
    90201
  ),
  (
    '00000000-0000-0000-0000-000000002003',
    'currentlyGrowing',
    90203
  );

insert into public.site_copy (
  copy_key,
  locale,
  copy_group,
  copy_value
)
values (
  'footer.leave_note_invitation',
  'en',
  'footer',
  'Phase 02D permission test'
)
on conflict (copy_key, locale) do update
set copy_value = excluded.copy_value;

insert into public.ai_settings (setting_key, setting_value)
values ('recommendation_wording', 'Phase 02D private setting')
on conflict (setting_key) do update
set setting_value = excluded.setting_value;

insert into public.visitor_notes (id, name, message)
values (
  '00000000-0000-0000-0000-000000002501',
  'Phase 02D',
  'Private visitor note'
);

insert into public.analytics_daily (event_type, event_date, event_count)
values ('page_view', date '1902-02-01', 1)
on conflict (event_type, event_date) do update
set event_count = excluded.event_count;

insert into public.route_redirects (
  id,
  old_path,
  new_path,
  status_code
)
values (
  '00000000-0000-0000-0000-000000002601',
  '/phase-02d-private-old-path',
  '/phase-02d-private-new-path',
  308
);

insert into public.preview_tokens (
  id,
  content_id,
  token_hash,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000002701',
  '00000000-0000-0000-0000-000000002003',
  'phase-02d-test-token-hash-00000000000000000000000000000000',
  now() + interval '1 hour'
);

-- Structural assertions run as the migration owner before role simulation.
do $$
declare
  missing_tables text;
  helper_is_secure boolean;
  helper_config text[];
begin
  select string_agg(required.table_name, ', ' order by required.table_name)
  into missing_tables
  from (
    values
      ('contents'),
      ('content_versions'),
      ('growth_notes'),
      ('content_relations'),
      ('tags'),
      ('content_tags'),
      ('home_curation'),
      ('site_copy'),
      ('ai_settings'),
      ('visitor_notes'),
      ('analytics_daily'),
      ('route_redirects'),
      ('preview_tokens')
  ) as required(table_name)
  left join pg_catalog.pg_class as relation
    on relation.relname = required.table_name
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
    and namespace.nspname = 'public'
  where namespace.oid is null
     or not relation.relrowsecurity;

  if missing_tables is not null then
    raise exception 'Phase 02D test failed: RLS is missing for %', missing_tables;
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'Phase 02D test failed: API roles have direct private schema access';
  end if;

  if has_table_privilege(
       'anon',
       'private.garden_keeper_identities',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'private.garden_keeper_identities',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'private.garden_keeper_identities',
       'UPDATE'
     )
     or has_table_privilege(
       'anon',
       'private.garden_keeper_identities',
       'DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'private.garden_keeper_identities',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.garden_keeper_identities',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'private.garden_keeper_identities',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'private.garden_keeper_identities',
       'DELETE'
     ) then
    raise exception 'Phase 02D test failed: API roles can access the Keeper allow-list';
  end if;

  if has_table_privilege('anon', 'public.visitor_notes', 'INSERT') then
    raise exception 'Phase 02D test failed: anonymous visitor-note insert is enabled early';
  end if;

  if not has_column_privilege('anon', 'public.contents', 'id', 'SELECT')
     or has_column_privilege('anon', 'public.contents', 'created_by', 'SELECT')
     or has_column_privilege('authenticated', 'public.contents', 'updated_by', 'SELECT') then
    raise exception 'Phase 02D test failed: contents column grants are not least privilege';
  end if;

  select procedure.prosecdef, procedure.proconfig
  into helper_is_secure, helper_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'is_garden_keeper'
    and procedure.pronargs = 0;

  if helper_is_secure is distinct from true then
    raise exception 'Phase 02D test failed: Keeper helper is not SECURITY DEFINER';
  end if;

  if helper_config is null
     or not ('search_path=pg_catalog, private' = any(helper_config)) then
    raise exception 'Phase 02D test failed: Keeper helper search_path is not fixed securely';
  end if;

  if exists (select 1 from private.garden_keeper_identities) then
    raise exception 'Phase 02D test failed: Keeper allow-list must be empty in Phase 02D';
  end if;
end;
$$;

-- Anonymous visitors see only the safe Published graph.
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
declare
  visible_count integer;
  denied boolean;
  private_table text;
begin
  select count(*)
  into visible_count
  from public.contents
  where id in (
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002002',
    '00000000-0000-0000-0000-000000002003',
    '00000000-0000-0000-0000-000000002004',
    '00000000-0000-0000-0000-000000002005'
  );

  if visible_count <> 2 then
    raise exception 'Phase 02D test failed: anon saw % test contents, expected 2 Published rows', visible_count;
  end if;

  select count(*) into visible_count
  from public.growth_notes
  where id in (
    '00000000-0000-0000-0000-000000002201',
    '00000000-0000-0000-0000-000000002202',
    '00000000-0000-0000-0000-000000002203'
  );
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: anon Growth Note count was %, expected 1', visible_count;
  end if;

  select count(*) into visible_count
  from public.content_relations
  where id in (
    '00000000-0000-0000-0000-000000002301',
    '00000000-0000-0000-0000-000000002302'
  );
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: anon relation count was %, expected 1', visible_count;
  end if;

  select count(*) into visible_count
  from public.tags
  where id in (
    '00000000-0000-0000-0000-000000002401',
    '00000000-0000-0000-0000-000000002402'
  );
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: anon tag count was %, expected 1', visible_count;
  end if;

  select count(*) into visible_count
  from public.content_tags
  where tag_id in (
    '00000000-0000-0000-0000-000000002401',
    '00000000-0000-0000-0000-000000002402'
  );
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: anon tag-binding count was %, expected 1', visible_count;
  end if;

  select count(*) into visible_count
  from public.home_curation
  where content_id in (
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002003'
  );
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: anon Home-curation count was %, expected 1', visible_count;
  end if;

  select count(*) into visible_count
  from public.site_copy
  where copy_key = 'footer.leave_note_invitation'
    and locale = 'en';
  if visible_count <> 1 then
    raise exception 'Phase 02D test failed: approved site copy was not publicly readable';
  end if;

  foreach private_table in array array[
    'content_versions',
    'ai_settings',
    'visitor_notes',
    'analytics_daily',
    'route_redirects',
    'preview_tokens'
  ]
  loop
    denied := false;
    begin
      execute format('select 1 from public.%I limit 1', private_table);
    exception
      when insufficient_privilege then
        denied := true;
    end;

    if not denied then
      raise exception 'Phase 02D test failed: anon can query private table %', private_table;
    end if;
  end loop;

  denied := false;
  begin
    execute $statement$
      select created_by
      from public.contents
      where id = '00000000-0000-0000-0000-000000002001'
    $statement$;
  exception
    when insufficient_privilege then
      denied := true;
  end;
  if not denied then
    raise exception 'Phase 02D test failed: anon can read contents.created_by';
  end if;

  denied := false;
  begin
    insert into public.visitor_notes (message)
    values ('Anonymous insertion must remain disabled in Phase 02D');
  exception
    when insufficient_privilege then
      denied := true;
  end;
  if not denied then
    raise exception 'Phase 02D test failed: anon inserted a visitor note';
  end if;
end;
$$;

reset role;

-- An authenticated but unapproved user remains a visitor for public reads and
-- cannot use any Garden Keeper policy.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000da01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-00000000da01',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  visible_count integer;
  affected_count integer;
  denied boolean;
  private_table text;
begin
  select count(*)
  into visible_count
  from public.contents
  where id in (
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002002',
    '00000000-0000-0000-0000-000000002003',
    '00000000-0000-0000-0000-000000002004',
    '00000000-0000-0000-0000-000000002005'
  );
  if visible_count <> 2 then
    raise exception 'Phase 02D test failed: unapproved authenticated user did not retain visitor reads';
  end if;

  foreach private_table in array array[
    'content_versions',
    'ai_settings',
    'visitor_notes',
    'analytics_daily',
    'route_redirects',
    'preview_tokens'
  ]
  loop
    execute format('select count(*) from public.%I', private_table)
      into visible_count;
    if visible_count <> 0 then
      raise exception 'Phase 02D test failed: unapproved authenticated user saw rows in %', private_table;
    end if;
  end loop;

  update public.contents
  set title_en = 'Unauthorized update'
  where id = '00000000-0000-0000-0000-000000002001';
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then
    raise exception 'Phase 02D test failed: unapproved authenticated user updated Published content';
  end if;

  denied := false;
  begin
    insert into public.contents (
      id,
      region,
      content_type,
      detail_level,
      growth_stage,
      title_en,
      content_language
    )
    values (
      '00000000-0000-0000-0000-000000002999',
      'Garden',
      'Seed',
      'short',
      'Seed',
      'Unauthorized Draft',
      'en'
    );
  exception
    when insufficient_privilege then
      denied := true;
  end;
  if not denied then
    raise exception 'Phase 02D test failed: unapproved authenticated user inserted content';
  end if;

  denied := false;
  begin
    insert into public.visitor_notes (message)
    values ('Unapproved authenticated insert');
  exception
    when insufficient_privilege then
      denied := true;
  end;
  if not denied then
    raise exception 'Phase 02D test failed: unapproved authenticated user inserted a visitor note';
  end if;
end;
$$;

reset role;

do $$
begin
  if private.is_garden_keeper() then
    raise exception 'Phase 02D test failed: helper approved a user absent from the allow-list';
  end if;
end;
$$;

rollback;
