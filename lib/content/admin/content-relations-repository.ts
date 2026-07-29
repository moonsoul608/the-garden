import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContentDatabase,
  ContentDatabaseRow,
  ContentRelationDatabaseRow,
} from "@/types/database";

import type {
  ContentRelationEditableFields,
  ContentRelationListItem,
  ContentRelationTargetOption,
} from "./content-relations-contracts";

export class ContentRelationsRepositoryError extends Error {
  constructor() {
    super("Content Relations could not be changed safely.");
    this.name = "ContentRelationsRepositoryError";
  }
}

export interface ContentRelationsRepository {
  getExistingContentIds(contentIds: readonly string[]): Promise<Set<string>>;
  listRelationTargets(
    sourceContentId: string,
  ): Promise<ContentRelationTargetOption[]>;
  listOutgoingRelations(
    sourceContentId: string,
  ): Promise<ContentRelationListItem[]>;
  findDuplicateRelation(
    fields: ContentRelationEditableFields & Readonly<{ sourceContentId: string }>,
  ): Promise<ContentRelationListItem | null>;
  createRelation(
    sourceContentId: string,
    fields: ContentRelationEditableFields,
  ): Promise<ContentRelationListItem>;
  deleteRelation(sourceContentId: string, relationId: string): Promise<boolean>;
}

type ContentRelationsRepositoryClient = SupabaseClient<ContentDatabase>;

type ContentSummaryRow = Pick<
  ContentDatabaseRow,
  | "id"
  | "slug"
  | "region"
  | "lifecycle"
  | "growth_stage"
  | "title_zh"
  | "title_en"
>;

function titleFor(row: ContentSummaryRow): string {
  return row.title_en?.trim() || row.title_zh?.trim() || row.slug || "Untitled";
}

function labelFor(row: ContentSummaryRow): string {
  return [
    titleFor(row),
    row.region,
    row.lifecycle,
    row.growth_stage ?? "No growth stage",
  ].join(" - ");
}

function mapTarget(row: ContentSummaryRow): ContentRelationTargetOption {
  return {
    id: row.id,
    label: labelFor(row),
    title: titleFor(row),
    region: row.region,
    lifecycle: row.lifecycle,
    growthStage: row.growth_stage,
    slug: row.slug,
  };
}

function mapRelation(
  row: ContentRelationDatabaseRow,
  target: ContentRelationTargetOption | null,
): ContentRelationListItem {
  return {
    id: row.id,
    sourceContentId: row.source_content_id,
    targetContentId: row.target_content_id,
    relationType: row.relation_type,
    noteZh: row.note_zh,
    noteEn: row.note_en,
    createdAt: row.created_at,
    target,
  };
}

async function getTargetsById(
  client: ContentRelationsRepositoryClient,
  ids: readonly string[],
): Promise<Map<string, ContentRelationTargetOption>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const result = await client
    .from("contents")
    .select("id,slug,region,lifecycle,growth_stage,title_zh,title_en")
    .in("id", uniqueIds);

  if (result.error) throw new ContentRelationsRepositoryError();
  return new Map(
    ((result.data ?? []) as ContentSummaryRow[]).map((row) => [
      row.id,
      mapTarget(row),
    ]),
  );
}

export function createContentRelationsRepository(
  client: ContentRelationsRepositoryClient,
): ContentRelationsRepository {
  async function getExistingContentIds(
    contentIds: readonly string[],
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(contentIds)];
    if (uniqueIds.length === 0) return new Set();

    const result = await client
      .from("contents")
      .select("id")
      .in("id", uniqueIds);

    if (result.error) throw new ContentRelationsRepositoryError();
    return new Set((result.data ?? []).map(({ id }) => id));
  }

  async function listRelationTargets(
    sourceContentId: string,
  ): Promise<ContentRelationTargetOption[]> {
    const result = await client
      .from("contents")
      .select("id,slug,region,lifecycle,growth_stage,title_zh,title_en")
      .neq("id", sourceContentId)
      .order("region", { ascending: true })
      .order("slug", { ascending: true });

    if (result.error) throw new ContentRelationsRepositoryError();
    return ((result.data ?? []) as ContentSummaryRow[]).map(mapTarget);
  }

  async function listOutgoingRelations(
    sourceContentId: string,
  ): Promise<ContentRelationListItem[]> {
    const result = await client
      .from("content_relations")
      .select("*")
      .eq("source_content_id", sourceContentId)
      .order("created_at", { ascending: false });

    if (result.error) throw new ContentRelationsRepositoryError();
    const rows = (result.data ?? []) as ContentRelationDatabaseRow[];
    const targets = await getTargetsById(
      client,
      rows.map((row) => row.target_content_id),
    );

    return rows.map((row) => mapRelation(row, targets.get(row.target_content_id) ?? null));
  }

  async function findDuplicateRelation(
    fields: ContentRelationEditableFields & Readonly<{ sourceContentId: string }>,
  ): Promise<ContentRelationListItem | null> {
    const result = await client
      .from("content_relations")
      .select("*")
      .eq("source_content_id", fields.sourceContentId)
      .eq("target_content_id", fields.targetContentId)
      .eq("relation_type", fields.relationType)
      .maybeSingle();

    if (result.error) throw new ContentRelationsRepositoryError();
    if (!result.data) return null;

    const targets = await getTargetsById(client, [fields.targetContentId]);
    return mapRelation(
      result.data as ContentRelationDatabaseRow,
      targets.get(fields.targetContentId) ?? null,
    );
  }

  async function createRelation(
    sourceContentId: string,
    fields: ContentRelationEditableFields,
  ): Promise<ContentRelationListItem> {
    const result = await client
      .from("content_relations")
      .insert({
        source_content_id: sourceContentId,
        target_content_id: fields.targetContentId,
        relation_type: fields.relationType,
        note_zh: fields.noteZh,
        note_en: fields.noteEn,
      })
      .select("*")
      .single();

    if (result.error || !result.data) {
      throw new ContentRelationsRepositoryError();
    }

    const targets = await getTargetsById(client, [fields.targetContentId]);
    return mapRelation(
      result.data as ContentRelationDatabaseRow,
      targets.get(fields.targetContentId) ?? null,
    );
  }

  async function deleteRelation(
    sourceContentId: string,
    relationId: string,
  ): Promise<boolean> {
    const result = await client
      .from("content_relations")
      .delete()
      .eq("id", relationId)
      .eq("source_content_id", sourceContentId)
      .select("id")
      .maybeSingle();

    if (result.error) throw new ContentRelationsRepositoryError();
    return Boolean(result.data);
  }

  return {
    getExistingContentIds,
    listRelationTargets,
    listOutgoingRelations,
    findDuplicateRelation,
    createRelation,
    deleteRelation,
  };
}

export type { ContentRelationsRepositoryClient };
