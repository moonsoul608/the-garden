import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContentDatabase,
  ContentDatabaseRow,
  ContentRevisionDatabaseRow,
  ContentVersionDatabaseRow,
} from "@/types/database";
import type { RegionName } from "@/types";

import type {
  LifecycleWorkspaceState,
  ManagedLifecycle,
} from "./lifecycle-management-contracts";

const CONTENT_COLUMNS = [
  "id",
  "slug",
  "region",
  "lifecycle",
  "title_zh",
  "title_en",
  "updated_at",
  "published_at",
  "archived_at",
].join(",");

const REVISION_COLUMNS = [
  "content_id",
  "lifecycle",
  "updated_at",
  "restored_at",
].join(",");

const VERSION_COLUMNS = [
  "id",
  "content_id",
  "checkpoint_reason",
  "created_at",
].join(",");

type LifecycleContentRow = Pick<
  ContentDatabaseRow,
  | "id"
  | "slug"
  | "region"
  | "lifecycle"
  | "title_zh"
  | "title_en"
  | "updated_at"
  | "published_at"
  | "archived_at"
> & { lifecycle: ManagedLifecycle };

type LifecycleRevisionRow = Pick<
  ContentRevisionDatabaseRow,
  "content_id" | "lifecycle" | "updated_at" | "restored_at"
>;

type LifecycleVersionRow = Pick<
  ContentVersionDatabaseRow,
  "id" | "content_id" | "checkpoint_reason" | "created_at"
>;

export type LifecycleManagementRecord = Readonly<{
  contentId: string;
  slug: string | null;
  region: RegionName;
  lifecycle: ManagedLifecycle;
  titleZh: string | null;
  titleEn: string | null;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  activeRevision: Readonly<{
    lifecycle: Exclude<LifecycleWorkspaceState, null>;
    updatedAt: string;
    restoredAt: string | null;
  }> | null;
  sourceArchive: Readonly<{
    versionId: string;
    createdAt: string;
  }> | null;
}>;

export class LifecycleManagementRepositoryError extends Error {
  constructor() {
    super("The lifecycle data source could not complete the request.");
    this.name = "LifecycleManagementRepositoryError";
  }
}

export interface LifecycleManagementReadRepository {
  listLifecycleRecords(): Promise<LifecycleManagementRecord[]>;
  getLifecycleRecord(
    region: RegionName,
    slug: string,
  ): Promise<LifecycleManagementRecord | null>;
}

export type LifecycleManagementRepositoryClient =
  SupabaseClient<ContentDatabase>;

function latestByContent<T extends { content_id: string; created_at: string }>(
  rows: readonly T[],
): Map<string, T> {
  const latest = new Map<string, T>();

  for (const row of rows) {
    const current = latest.get(row.content_id);
    if (!current || Date.parse(row.created_at) > Date.parse(current.created_at)) {
      latest.set(row.content_id, row);
    }
  }

  return latest;
}

export function createLifecycleManagementReadRepository(
  client: LifecycleManagementRepositoryClient,
): LifecycleManagementReadRepository {
  async function enrich(
    contents: readonly LifecycleContentRow[],
  ): Promise<LifecycleManagementRecord[]> {
    if (contents.length === 0) return [];

    const contentIds = contents.map(({ id }) => id);
    const archivedContentIds = contents
      .filter(({ lifecycle }) => lifecycle === "Archived")
      .map(({ id }) => id);
    const revisionResult = await client
      .from("content_revisions")
      .select(REVISION_COLUMNS)
      .in("content_id", contentIds);

    if (revisionResult.error) throw new LifecycleManagementRepositoryError();

    const versionResult =
      archivedContentIds.length === 0
        ? { data: [] as LifecycleVersionRow[], error: null }
        : await client
            .from("content_versions")
            .select(VERSION_COLUMNS)
            .in("content_id", archivedContentIds)
            .eq("checkpoint_reason", "Archived")
            .order("created_at", { ascending: false });

    if (versionResult.error) throw new LifecycleManagementRepositoryError();

    const revisions = new Map(
      ((revisionResult.data ?? []) as unknown as LifecycleRevisionRow[]).map(
        (revision) => [revision.content_id, revision],
      ),
    );
    const archiveVersions = latestByContent(
      (versionResult.data ?? []) as unknown as LifecycleVersionRow[],
    );

    return contents.map((content) => {
      const revision = revisions.get(content.id);
      const archiveVersion = archiveVersions.get(content.id);

      return {
        contentId: content.id,
        slug: content.slug,
        region: content.region,
        lifecycle: content.lifecycle,
        titleZh: content.title_zh,
        titleEn: content.title_en,
        updatedAt: content.updated_at,
        publishedAt: content.published_at,
        archivedAt: content.archived_at,
        activeRevision: revision
          ? {
              lifecycle: revision.lifecycle,
              updatedAt: revision.updated_at,
              restoredAt: revision.restored_at,
            }
          : null,
        sourceArchive: archiveVersion
          ? {
              versionId: archiveVersion.id,
              createdAt: archiveVersion.created_at,
            }
          : null,
      };
    });
  }

  async function listLifecycleRecords(): Promise<LifecycleManagementRecord[]> {
    const result = await client
      .from("contents")
      .select(CONTENT_COLUMNS)
      .in("lifecycle", ["Published", "Archived"])
      .order("updated_at", { ascending: false });

    if (result.error) throw new LifecycleManagementRepositoryError();

    return enrich(
      (result.data ?? []) as unknown as LifecycleContentRow[],
    );
  }

  async function getLifecycleRecord(
    region: RegionName,
    slug: string,
  ): Promise<LifecycleManagementRecord | null> {
    const result = await client
      .from("contents")
      .select(CONTENT_COLUMNS)
      .eq("region", region)
      .eq("slug", slug)
      .in("lifecycle", ["Published", "Archived"])
      .maybeSingle();

    if (result.error) throw new LifecycleManagementRepositoryError();
    if (!result.data) return null;

    return (
      await enrich([result.data as unknown as LifecycleContentRow])
    )[0] ?? null;
  }

  return { listLifecycleRecords, getLifecycleRecord };
}
