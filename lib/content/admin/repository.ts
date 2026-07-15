import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lifecycle } from "@/types";
import type {
  ContentDatabase,
  ContentRevisionDatabaseRow,
  ContentRevisionDatabaseUpdate,
  Json,
} from "@/types/database";

import type { DraftContentFields, DraftRevision } from "./contracts";
import {
  ContentMutationError,
  mapContentMutationDatabaseError,
  type ContentMutationOperation,
} from "./errors";

const REVISION_COLUMNS = [
  "id",
  "content_id",
  "lifecycle",
  "slug",
  "region",
  "content_type",
  "detail_level",
  "growth_stage",
  "title_zh",
  "title_en",
  "summary_zh",
  "summary_en",
  "body_zh_markdown",
  "body_en_markdown",
  "content_language",
  "primary_categories",
  "tags",
  "cover_image_path",
  "cover_image_alt_zh",
  "cover_image_alt_en",
  "featured",
  "manual_order",
  "base_content_updated_at",
  "lock_version",
  "created_at",
  "updated_at",
].join(",");

export type ContentWorkflowState = {
  contentId: string;
  lifecycle: Lifecycle;
};

export interface ContentWriteRepository {
  createDraft(fields: DraftContentFields): Promise<DraftRevision>;
  getContentWorkflowState(
    contentId: string,
  ): Promise<ContentWorkflowState | null>;
  getDraftRevision(
    contentId: string,
    revisionId: string,
  ): Promise<DraftRevision | null>;
  updateDraft(
    current: DraftRevision,
    fields: DraftContentFields,
    expectedLockVersion: number,
  ): Promise<DraftRevision>;
  startDraftRevision(contentId: string): Promise<DraftRevision>;
}

type ContentWriteRepositoryClient = SupabaseClient<ContentDatabase>;

function mapRevision(row: ContentRevisionDatabaseRow): DraftRevision {
  return {
    contentId: row.content_id,
    revisionId: row.id,
    lifecycle: row.lifecycle,
    lockVersion: row.lock_version,
    baseContentUpdatedAt: row.base_content_updated_at,
    slug: row.slug,
    region: row.region,
    contentType: row.content_type,
    detailLevel: row.detail_level,
    growthStage: row.growth_stage,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    summaryZh: row.summary_zh,
    summaryEn: row.summary_en,
    bodyZhMarkdown: row.body_zh_markdown,
    bodyEnMarkdown: row.body_en_markdown,
    contentLanguage: row.content_language,
    primaryCategories: [...row.primary_categories],
    tags: [...row.tags],
    cover: row.cover_image_path
      ? {
          path: row.cover_image_path,
          altZh: row.cover_image_alt_zh,
          altEn: row.cover_image_alt_en,
        }
      : null,
    featured: row.featured,
    manualOrder: row.manual_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDraftRpcPayload(fields: DraftContentFields): Json {
  return {
    slug: fields.slug,
    region: fields.region,
    contentType: fields.contentType,
    detailLevel: fields.detailLevel,
    growthStage: fields.growthStage,
    titleZh: fields.titleZh,
    titleEn: fields.titleEn,
    summaryZh: fields.summaryZh,
    summaryEn: fields.summaryEn,
    bodyZhMarkdown: fields.bodyZhMarkdown,
    bodyEnMarkdown: fields.bodyEnMarkdown,
    contentLanguage: fields.contentLanguage,
    primaryCategories: fields.primaryCategories,
    tags: fields.tags,
    coverImagePath: fields.cover?.path ?? null,
    coverImageAltZh: fields.cover?.altZh ?? null,
    coverImageAltEn: fields.cover?.altEn ?? null,
    featured: fields.featured,
    manualOrder: fields.manualOrder,
  };
}

function toRevisionUpdate(
  fields: DraftContentFields,
): ContentRevisionDatabaseUpdate {
  return {
    lifecycle: "Draft",
    slug: fields.slug,
    region: fields.region,
    content_type: fields.contentType,
    detail_level: fields.detailLevel,
    growth_stage: fields.growthStage,
    title_zh: fields.titleZh,
    title_en: fields.titleEn,
    summary_zh: fields.summaryZh,
    summary_en: fields.summaryEn,
    body_zh_markdown: fields.bodyZhMarkdown,
    body_en_markdown: fields.bodyEnMarkdown,
    content_language: fields.contentLanguage,
    primary_categories: fields.primaryCategories,
    tags: fields.tags,
    cover_image_path: fields.cover?.path ?? null,
    cover_image_alt_zh: fields.cover?.altZh ?? null,
    cover_image_alt_en: fields.cover?.altEn ?? null,
    featured: fields.featured,
    manual_order: fields.manualOrder,
  };
}

function throwRepositoryError(
  error: unknown,
  operation: ContentMutationOperation,
): never {
  throw mapContentMutationDatabaseError(error, operation);
}

export function createContentWriteRepository(
  client: ContentWriteRepositoryClient,
): ContentWriteRepository {
  async function createDraft(
    fields: DraftContentFields,
  ): Promise<DraftRevision> {
    const result = await client.rpc("create_content_draft", {
      p_draft: toDraftRpcPayload(fields),
    });

    if (result.error) throwRepositoryError(result.error, "createDraft");
    if (!result.data) {
      throw new ContentMutationError("repository_failure", "createDraft");
    }

    return mapRevision(result.data as ContentRevisionDatabaseRow);
  }

  async function getContentWorkflowState(
    contentId: string,
  ): Promise<ContentWorkflowState | null> {
    const result = await client
      .from("contents")
      .select("id,lifecycle")
      .eq("id", contentId)
      .maybeSingle();

    if (result.error) {
      throwRepositoryError(result.error, "readContentWorkflow");
    }

    return result.data
      ? {
          contentId: result.data.id,
          lifecycle: result.data.lifecycle,
        }
      : null;
  }

  async function getDraftRevision(
    contentId: string,
    revisionId: string,
  ): Promise<DraftRevision | null> {
    const result = await client
      .from("content_revisions")
      .select(REVISION_COLUMNS)
      .eq("content_id", contentId)
      .eq("id", revisionId)
      .maybeSingle();

    if (result.error) {
      throwRepositoryError(result.error, "readDraftRevision");
    }

    return result.data
      ? mapRevision(result.data as unknown as ContentRevisionDatabaseRow)
      : null;
  }

  async function updateDraft(
    current: DraftRevision,
    fields: DraftContentFields,
    expectedLockVersion: number,
  ): Promise<DraftRevision> {
    const result = await client
      .from("content_revisions")
      .update(toRevisionUpdate(fields))
      .eq("content_id", current.contentId)
      .eq("id", current.revisionId)
      .eq("lifecycle", "Draft")
      .eq("lock_version", expectedLockVersion)
      .select(REVISION_COLUMNS)
      .maybeSingle();

    if (result.error) throwRepositoryError(result.error, "updateDraft");
    if (!result.data) {
      throw new ContentMutationError("revision_conflict", "updateDraft");
    }

    return mapRevision(
      result.data as unknown as ContentRevisionDatabaseRow,
    );
  }

  async function startDraftRevision(
    contentId: string,
  ): Promise<DraftRevision> {
    const result = await client.rpc("start_content_draft_revision", {
      p_content_id: contentId,
    });

    if (result.error) {
      throwRepositoryError(result.error, "startDraftRevision");
    }
    if (!result.data) {
      throw new ContentMutationError(
        "repository_failure",
        "startDraftRevision",
      );
    }

    return mapRevision(result.data as ContentRevisionDatabaseRow);
  }

  return {
    createDraft,
    getContentWorkflowState,
    getDraftRevision,
    updateDraft,
    startDraftRevision,
  };
}

export type { ContentWriteRepositoryClient };
