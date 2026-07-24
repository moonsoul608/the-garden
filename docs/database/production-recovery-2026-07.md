# Production Recovery Archive - July 2026

This note preserves the historical context for the July 2026 Phase04 production recovery while keeping duplicate, manual recovery SQL out of the active Supabase migration chain.

## Why Recovery Was Needed

Production drifted from the committed database history during the Phase04 content workflow rollout. The visible failures were in the review and publishing path:

- publishing depended on missing Phase04D content version receipt columns and the `publish_review_revision(uuid, uuid, bigint)` RPC;
- Submit for Review could move a revision to `Review` while leaving review audit fields unset;
- an intermediate restore-aware audit trigger function referenced `restore_operation_id`, but the Production `public.content_revisions` table did not contain that column.

The verified workflow after repair is:

```text
Draft -> Review -> Return to Draft -> Review -> Publish
```

## Committed Repair Migrations

The forward-only repair history is now represented by these committed migrations:

- `20260723120000_restore_phase_04c_content_revision_schema.sql`
  Restores the Phase04C content revision schema required by the review workflow.
- `20260724100000_restore_phase_04d_publishing.sql`
  Restores the Phase04D publishing receipt columns, publication receipt index, constraints, and `public.publish_review_revision(uuid, uuid, bigint)` with the final Phase08-compatible growth-stage validation.
- `20260724110000_restore_content_revision_audit_fields.sql`
  Records the applied intermediate restore-aware `public.set_content_revision_audit_fields()` definition. This migration was manually applied to Production but was incompatible with the current Production schema because it referenced `restore_operation_id`.
- `20260724120000_restore_review_workflow_audit_trigger.sql`
  Supersedes `20260724110000` in Production by restoring the current Production-compatible Review workflow audit trigger function.

`20260724110000` remains in the committed history because Production executed it. `20260724120000` is the current effective audit trigger definition and intentionally supersedes that intermediate state.

## Archived 20260719 Recovery Scripts

The following untracked recovery scripts were removed from `supabase/migrations/` after their historical purpose was documented here. Their exact manual Production application status is unverified.

| File | Purpose | Committed canonical migration/object duplicated | Reason excluded from active migration chain |
| --- | --- | --- | --- |
| `20260719100000_restore_keeper_media_workspace_rpc.sql` | Restored `public.list_keeper_media_workspace()` for Keeper-only media workspace visibility. | `20260717090000_phase_05e_media_workspace.sql` / `public.list_keeper_media_workspace()` | Duplicate of an already committed RPC recovery object. It is historical context only. |
| `20260719105000_restore_phase_04d_storage_reference_enums.sql` | Restored or validated Phase04D storage reference enum contracts. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / storage reference enum types | Duplicate enum recovery. It is not part of the final production workflow repair chain. |
| `20260719107500_restore_phase_04d_storage_version_reference_paths.sql` | Restored `private.storage_version_reference_paths(jsonb)`. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / `private.storage_version_reference_paths(jsonb)` | Duplicate helper function; uses plain `create function`, so it is not fresh-install-safe when the canonical migration has already run. |
| `20260719108000_restore_phase_04d_register_storage_object_reference.sql` | Restored `private.register_storage_object_reference(text, text, public.storage_reference_owner_type, uuid, uuid)`. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / `private.register_storage_object_reference(...)` | Duplicate helper function; uses plain `create function`, so it is not fresh-install-safe when the canonical migration has already run. |
| `20260719108500_restore_phase_04d_release_storage_object_owner_references.sql` | Restored `private.release_storage_object_owner_references(public.storage_reference_owner_type, uuid)`. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / `private.release_storage_object_owner_references(...)` | Duplicate helper function; uses plain `create function`, so it is not fresh-install-safe when the canonical migration has already run. |
| `20260719109000_restore_phase_04d_sync_content_projection_storage_reference.sql` | Restored `private.sync_content_projection_storage_reference()` for content projection cover references. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / `private.sync_content_projection_storage_reference()` | Duplicate trigger helper; uses plain `create function`, so it is not fresh-install-safe when the canonical migration has already run. |
| `20260719110000_restore_phase_04d_storage_reference_objects.sql` | Broad storage-reference object repair: storage reference tables, lifecycle table, triggers, backfill, quarantine/purge helpers, and related privileges. | `20260716040000_phase_04d_storage_reference_purge_safety.sql` / Phase04D storage reference and purge-safety objects | Broad duplicate restore work outside the final publishing/review repair scope; portions use plain `create function` and `create trigger`, making it not fresh-install-safe against the canonical migration chain. |

These scripts are excluded from the active migration chain because they duplicate committed canonical migrations or include plain object creation that can fail on a fresh database after the canonical migrations have already created the same functions or triggers.

They are preserved here as recovery context rather than committed SQL.
