import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, ContentDatabaseRow, ContentRevisionDatabaseRow } from "@/types/database";

import type { AdminContentListRecord } from "./content-management-contracts";

const CONTENT_LIST_COLUMNS = [
  "id",
  "lifecycle",
  "title_zh",
  "title_en",
  "region",
  "growth_stage",
  "updated_at",
].join(",");

const REVISION_LIST_COLUMNS = [
  "id",
  "content_id",
  "lifecycle",
  "lock_version",
  "title_zh",
  "title_en",
  "region",
  "growth_stage",
  "updated_at",
].join(",");

type ContentListRow = Pick<
  ContentDatabaseRow,
  | "id"
  | "lifecycle"
  | "title_zh"
  | "title_en"
  | "region"
  | "growth_stage"
  | "updated_at"
>;

type RevisionListRow = Pick<
  ContentRevisionDatabaseRow,
  | "id"
  | "content_id"
  | "lifecycle"
  | "lock_version"
  | "title_zh"
  | "title_en"
  | "region"
  | "growth_stage"
  | "updated_at"
>;

export class ContentManagementRepositoryError extends Error {
  constructor() {
    super("The content workbench data source could not complete the request.");
    this.name = "ContentManagementRepositoryError";
  }
}

export interface ContentManagementReadRepository {
  listContentRecords(): Promise<AdminContentListRecord[]>;
}

type ContentManagementRepositoryClient = SupabaseClient<ContentDatabase>;

export function createContentManagementReadRepository(
  client: ContentManagementRepositoryClient,
): ContentManagementReadRepository {
  async function listContentRecords(): Promise<AdminContentListRecord[]> {
    const contentResult = await client
      .from("contents")
      .select(CONTENT_LIST_COLUMNS)
      .order("updated_at", { ascending: false });

    if (contentResult.error) throw new ContentManagementRepositoryError();

    const contents = (contentResult.data ?? []) as unknown as ContentListRow[];
    if (contents.length === 0) return [];

    const revisionResult = await client
      .from("content_revisions")
      .select(REVISION_LIST_COLUMNS)
      .in(
        "content_id",
        contents.map(({ id }) => id),
      );

    if (revisionResult.error) throw new ContentManagementRepositoryError();

    const revisions = new Map(
      ((revisionResult.data ?? []) as unknown as RevisionListRow[]).map(
        (revision) => [revision.content_id, revision],
      ),
    );

    return contents.map((content) => {
      const revision = revisions.get(content.id);

      return {
        contentId: content.id,
        lifecycle: content.lifecycle,
        titleZh: content.title_zh,
        titleEn: content.title_en,
        region: content.region,
        growthStage: content.growth_stage,
        updatedAt: content.updated_at,
        activeRevision: revision
          ? {
              revisionId: revision.id,
              lifecycle: revision.lifecycle,
              lockVersion: revision.lock_version,
              titleZh: revision.title_zh,
              titleEn: revision.title_en,
              region: revision.region,
              growthStage: revision.growth_stage,
              updatedAt: revision.updated_at,
            }
          : null,
      };
    });
  }

  return { listContentRecords };
}

export type { ContentManagementRepositoryClient };
