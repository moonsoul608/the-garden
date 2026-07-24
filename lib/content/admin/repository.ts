import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lifecycle } from "@/types";
import type {
  ContentDatabase,
  ContentDatabaseRow,
  ContentRelationDatabaseRow,
  ContentRevisionDatabaseRow,
  ContentRevisionDatabaseUpdate,
  GrowthNoteDatabaseRow,
  Json,
} from "@/types/database";
import type {
  GrowthNoteCandidate,
  RelationCandidate,
} from "@/lib/content/validation";

import type {
  DraftContentFields,
  DraftListFilters,
  DraftRevision,
  PublicationReceipt,
  PublishReviewInput,
  ReviewSlugConflict,
} from "./contracts";
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
  "source_version_id",
  "base_content_updated_at",
  "review_submitted_at",
  "returned_to_draft_at",
  "lock_version",
  "created_at",
  "updated_at",
].join(",");

const CONTENT_PROJECTION_COLUMNS = [
  "id",
  "slug",
  "region",
  "content_type",
  "detail_level",
  "lifecycle",
  "growth_stage",
  "title_zh",
  "title_en",
  "summary_zh",
  "summary_en",
  "body_zh_markdown",
  "body_en_markdown",
  "content_language",
  "primary_categories",
  "cover_image_path",
  "cover_image_alt_zh",
  "cover_image_alt_en",
  "featured",
  "manual_order",
].join(",");

export type ContentWorkflowState = {
  contentId: string;
  lifecycle: Lifecycle;
};

export type ReviewPreparationContext = {
  publishedProjection: DraftContentFields | null;
  slugConflicts: ReviewSlugConflict[];
  growthNotes: GrowthNoteCandidate[];
  relations: RelationCandidate[];
  existingContentIds: string[];
};

export interface ContentWriteRepository {
  createDraft(fields: DraftContentFields): Promise<DraftRevision>;
  getDraftById(revisionId: string): Promise<DraftRevision | null>;
  listDrafts(filters?: DraftListFilters): Promise<DraftRevision[]>;
  getReviewById(revisionId: string): Promise<DraftRevision | null>;
  listReviews(): Promise<DraftRevision[]>;
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
  getReviewPreparationContext(
    revision: DraftRevision,
    operation?: "prepareReview" | "publishReview",
  ): Promise<ReviewPreparationContext>;
  submitForReview(
    current: DraftRevision,
    expectedLockVersion: number,
  ): Promise<DraftRevision>;
  returnToDraft(
    current: DraftRevision,
    expectedLockVersion: number,
  ): Promise<DraftRevision>;
  publishReview(input: PublishReviewInput): Promise<PublicationReceipt>;
  startDraftRevision(contentId: string): Promise<DraftRevision>;
}

type ContentWriteRepositoryClient = SupabaseClient<ContentDatabase>;

function mapRevision(row: ContentRevisionDatabaseRow): DraftRevision {
  return {
    contentId: row.content_id,
    revisionId: row.id,
    lifecycle: row.lifecycle,
    lockVersion: row.lock_version,
    sourceVersionId: row.source_version_id,
    baseContentUpdatedAt: row.base_content_updated_at,
    reviewSubmittedAt: row.review_submitted_at,
    returnedToDraftAt: row.returned_to_draft_at,
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

function mapPublicationReceipt(value: Json): PublicationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContentMutationError("repository_failure", "publishReview");
  }

  const {
    contentId,
    revisionId,
    versionId,
    sourceLockVersion,
    publishedAt,
    publishedBy,
  } = value;

  if (
    typeof contentId !== "string" ||
    typeof revisionId !== "string" ||
    typeof versionId !== "string" ||
    !Number.isSafeInteger(sourceLockVersion) ||
    (sourceLockVersion as number) < 1 ||
    typeof publishedAt !== "string" ||
    typeof publishedBy !== "string"
  ) {
    throw new ContentMutationError("repository_failure", "publishReview");
  }

  return {
    contentId,
    revisionId,
    versionId,
    sourceLockVersion: sourceLockVersion as number,
    publishedAt,
    publishedBy,
  };
}

function describeJsonShape(value: Json): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") {
    return `object(${Object.keys(value).sort().join(",")})`;
  }
  return typeof value;
}

function mapPublishedProjection(
  row: ContentDatabaseRow,
  tags: string[],
): DraftContentFields {
  return {
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
    tags,
    cover: row.cover_image_path
      ? {
          path: row.cover_image_path,
          altZh: row.cover_image_alt_zh,
          altEn: row.cover_image_alt_en,
        }
      : null,
    featured: row.featured,
    manualOrder: row.manual_order,
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

  async function getDraftById(
    revisionId: string,
  ): Promise<DraftRevision | null> {
    const result = await client
      .from("content_revisions")
      .select(REVISION_COLUMNS)
      .eq("id", revisionId)
      .eq("lifecycle", "Draft")
      .maybeSingle();

    if (result.error) {
      throwRepositoryError(result.error, "getDraftById");
    }

    return result.data
      ? mapRevision(result.data as unknown as ContentRevisionDatabaseRow)
      : null;
  }

  async function listDrafts(
    filters: DraftListFilters = {},
  ): Promise<DraftRevision[]> {
    try {
      let query = client
        .from("content_revisions")
        .select(REVISION_COLUMNS)
        .eq("lifecycle", "Draft");

      if (filters.region) query = query.eq("region", filters.region);
      if (filters.contentType) {
        query = query.eq("content_type", filters.contentType);
      }
      if (filters.growthStage) {
        query = query.eq("growth_stage", filters.growthStage);
      }

      const result = await query.order("updated_at", { ascending: false });
      if (result.error) {
        throwRepositoryError(result.error, "listDrafts");
      }

      return (result.data ?? []).map((row) =>
        mapRevision(row as unknown as ContentRevisionDatabaseRow),
      );
    } catch (error) {
      throw error;
    }
  }

  async function getReviewById(
    revisionId: string,
  ): Promise<DraftRevision | null> {
    const result = await client
      .from("content_revisions")
      .select(REVISION_COLUMNS)
      .eq("id", revisionId)
      .eq("lifecycle", "Review")
      .maybeSingle();

    if (result.error) {
      throwRepositoryError(result.error, "getReviewById");
    }

    return result.data
      ? mapRevision(result.data as unknown as ContentRevisionDatabaseRow)
      : null;
  }

  async function listReviews(): Promise<DraftRevision[]> {
    const result = await client
      .from("content_revisions")
      .select(REVISION_COLUMNS)
      .eq("lifecycle", "Review")
      .order("review_submitted_at", { ascending: false });

    if (result.error) throwRepositoryError(result.error, "listReviews");

    return (result.data ?? []).map((row) =>
      mapRevision(row as unknown as ContentRevisionDatabaseRow),
    );
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

  async function getReviewPreparationContext(
    revision: DraftRevision,
    operation: "prepareReview" | "publishReview" = "prepareReview",
  ): Promise<ReviewPreparationContext> {
    const publishedResult = await client
      .from("contents")
      .select(CONTENT_PROJECTION_COLUMNS)
      .eq("id", revision.contentId)
      .maybeSingle();
    if (publishedResult.error) {
      throwRepositoryError(publishedResult.error, operation);
    }

    let slugConflicts: ReviewSlugConflict[] = [];
    if (revision.slug) {
      const conflictResult = await client
        .from("contents")
        .select("id,lifecycle")
        .eq("region", revision.region)
        .eq("slug", revision.slug)
        .neq("id", revision.contentId);
      if (conflictResult.error) {
        throwRepositoryError(conflictResult.error, operation);
      }
      slugConflicts = (conflictResult.data ?? []).map((conflict) => ({
        contentId: conflict.id,
        lifecycle: conflict.lifecycle,
      }));
    }

    const growthNoteResult = await client
      .from("growth_notes")
      .select("content_id,from_stage,to_stage,note_zh,note_en,is_public")
      .eq("content_id", revision.contentId);
    if (growthNoteResult.error) {
      throwRepositoryError(growthNoteResult.error, operation);
    }
    const growthNotes = (growthNoteResult.data ?? []).map((row) => {
      const note = row as Pick<
        GrowthNoteDatabaseRow,
        | "content_id"
        | "from_stage"
        | "to_stage"
        | "note_zh"
        | "note_en"
        | "is_public"
      >;
      return {
        contentId: note.content_id,
        fromStage: note.from_stage,
        toStage: note.to_stage,
        noteZh: note.note_zh,
        noteEn: note.note_en,
        isPublic: note.is_public,
      };
    });

    const sourceRelationResult = await client
      .from("content_relations")
      .select(
        "source_content_id,target_content_id,relation_type,note_zh,note_en",
      )
      .eq("source_content_id", revision.contentId);
    if (sourceRelationResult.error) {
      throwRepositoryError(sourceRelationResult.error, operation);
    }
    const targetRelationResult = await client
      .from("content_relations")
      .select(
        "source_content_id,target_content_id,relation_type,note_zh,note_en",
      )
      .eq("target_content_id", revision.contentId);
    if (targetRelationResult.error) {
      throwRepositoryError(targetRelationResult.error, operation);
    }

    const relationRows = [
      ...(sourceRelationResult.data ?? []),
      ...(targetRelationResult.data ?? []),
    ] as Pick<
      ContentRelationDatabaseRow,
      | "source_content_id"
      | "target_content_id"
      | "relation_type"
      | "note_zh"
      | "note_en"
    >[];
    const relations = relationRows.map((relation) => ({
      sourceContentId: relation.source_content_id,
      targetContentId: relation.target_content_id,
      relationType: relation.relation_type,
      noteZh: relation.note_zh,
      noteEn: relation.note_en,
    }));
    const endpointIds = [
      ...new Set(
        relationRows.flatMap((relation) => [
          relation.source_content_id,
          relation.target_content_id,
        ]),
      ),
    ];

    let existingContentIds: string[] = [];
    if (endpointIds.length > 0) {
      const endpointResult = await client
        .from("contents")
        .select("id")
        .in("id", endpointIds);
      if (endpointResult.error) {
        throwRepositoryError(endpointResult.error, operation);
      }
      existingContentIds = (endpointResult.data ?? []).map(({ id }) => id);
    }

    const projectionRow = publishedResult.data
      ? (publishedResult.data as unknown as ContentDatabaseRow)
      : null;
    const hasPublishedProjection =
      projectionRow !== null &&
      revision.baseContentUpdatedAt !== null &&
      (projectionRow.lifecycle === "Published" ||
        projectionRow.lifecycle === "Archived");
    let publishedTags: string[] = [];
    if (hasPublishedProjection) {
      const bindingResult = await client
        .from("content_tags")
        .select("tag_id")
        .eq("content_id", revision.contentId);
      if (bindingResult.error) {
        throwRepositoryError(bindingResult.error, operation);
      }
      const tagIds = (bindingResult.data ?? []).map(({ tag_id }) => tag_id);
      if (tagIds.length > 0) {
        const tagResult = await client
          .from("tags")
          .select("display_name")
          .in("id", tagIds);
        if (tagResult.error) {
          throwRepositoryError(tagResult.error, operation);
        }
        publishedTags = (tagResult.data ?? [])
          .map(({ display_name }) => display_name)
          .sort((left, right) => left.localeCompare(right));
      }
    }

    return {
      publishedProjection: hasPublishedProjection
        ? mapPublishedProjection(projectionRow, publishedTags)
        : null,
      slugConflicts,
      growthNotes,
      relations,
      existingContentIds,
    };
  }

  async function transitionRevision(
    current: DraftRevision,
    expectedLockVersion: number,
    lifecycle: "Draft" | "Review",
    operation: "submitForReview" | "returnToDraft",
  ): Promise<DraftRevision> {
    const result = await client
      .from("content_revisions")
      .update({ lifecycle })
      .eq("content_id", current.contentId)
      .eq("id", current.revisionId)
      .eq("lifecycle", current.lifecycle)
      .eq("lock_version", expectedLockVersion)
      .select(REVISION_COLUMNS)
      .maybeSingle();

    if (result.error) {
      throwRepositoryError(result.error, operation);
    }
    if (!result.data) {
      throw new ContentMutationError("revision_conflict", operation);
    }

    return mapRevision(
      result.data as unknown as ContentRevisionDatabaseRow,
    );
  }

  async function submitForReview(
    current: DraftRevision,
    expectedLockVersion: number,
  ): Promise<DraftRevision> {
    return transitionRevision(
      current,
      expectedLockVersion,
      "Review",
      "submitForReview",
    );
  }

  async function returnToDraft(
    current: DraftRevision,
    expectedLockVersion: number,
  ): Promise<DraftRevision> {
    return transitionRevision(
      current,
      expectedLockVersion,
      "Draft",
      "returnToDraft",
    );
  }

  async function publishReview(
    input: PublishReviewInput,
  ): Promise<PublicationReceipt> {
    const result = await client.rpc("publish_review_revision", {
      p_content_id: input.contentId,
      p_revision_id: input.revisionId,
      p_expected_lock_version: input.expectedLockVersion,
    });

    if (result.error) {
      throwRepositoryError(result.error, "publishReview");
    }

    return mapPublicationReceipt(result.data);
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
    getDraftById,
    listDrafts,
    getReviewById,
    listReviews,
    getContentWorkflowState,
    getDraftRevision,
    updateDraft,
    getReviewPreparationContext,
    submitForReview,
    returnToDraft,
    publishReview,
    startDraftRevision,
  };
}

export type { ContentWriteRepositoryClient };
