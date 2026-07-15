import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getContentSourceMode,
  type ContentSourceMode,
} from "@/lib/content/service";
import type { ContentValidationResult } from "@/lib/content/errors";
import { assertContentValid } from "@/lib/content/errors";
import {
  validateContentRelations,
  validateGrowthStageConsistency,
  validateLifecycleRequirements,
  validateLifecycleTransition,
  validateDraftLifecycleMutation,
  validateReviewTaxonomy,
  validateSlugAvailability,
  validateStableRegion,
  validateStableSlug,
  validateTags,
} from "@/lib/content/validation";

import type {
  AdminContentService,
  ArchiveContentInput,
  ArchiveReceipt,
  CreateDraftInput,
  DraftContentFields,
  DraftListFilters,
  DraftRevision,
  PrepareReviewInput,
  PublicationReceipt,
  PublishReviewInput,
  ReviewCoverStatus,
  ReviewDifferenceSummary,
  ReviewReadinessReport,
  ReviewTransitionInput,
  StartDraftRevisionInput,
  UpdateDraftInput,
} from "./contracts";
import { ContentMutationError } from "./errors";
import {
  createArchiveRepository,
  type ArchiveRepository,
  type ArchiveRepositoryClient,
} from "./archive-repository";
import {
  createContentWriteRepository,
  type ReviewPreparationContext,
  type ContentWriteRepository,
  type ContentWriteRepositoryClient,
} from "./repository";

type AuthorizeAdminRequest = () => Promise<AuthenticatedUser>;

export type AdminContentServiceDependencies = {
  authorize?: AuthorizeAdminRequest;
  repository?: ContentWriteRepository;
  repositoryFactory?: () => Promise<ContentWriteRepository>;
  archiveRepository?: ArchiveRepository;
  archiveRepositoryFactory?: () => Promise<ArchiveRepository>;
  sourceMode?: ContentSourceMode;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeList(values: readonly string[] | undefined): string[] {
  const normalized = new Map<string, string>();

  for (const value of values ?? []) {
    const display = value.trim();
    if (display) normalized.set(display.toLocaleLowerCase(), display);
  }

  return [...normalized.values()];
}

function normalizeCreateDraft(input: CreateDraftInput): DraftContentFields {
  const coverPath = normalizeOptionalText(input.cover?.path);

  return {
    slug: normalizeOptionalText(input.slug)?.toLocaleLowerCase() ?? null,
    region: input.region,
    contentType: input.contentType,
    detailLevel: input.detailLevel,
    growthStage: input.growthStage,
    titleZh: normalizeOptionalText(input.titleZh),
    titleEn: normalizeOptionalText(input.titleEn),
    summaryZh: normalizeOptionalText(input.summaryZh),
    summaryEn: normalizeOptionalText(input.summaryEn),
    bodyZhMarkdown: normalizeOptionalText(input.bodyZhMarkdown),
    bodyEnMarkdown: normalizeOptionalText(input.bodyEnMarkdown),
    contentLanguage: input.contentLanguage,
    primaryCategories: normalizeList(input.primaryCategories),
    tags: normalizeList(input.tags),
    cover: coverPath
      ? {
          path: coverPath,
          altZh: normalizeOptionalText(input.cover?.altZh),
          altEn: normalizeOptionalText(input.cover?.altEn),
        }
      : input.cover
        ? {
            path: "",
            altZh: normalizeOptionalText(input.cover.altZh),
            altEn: normalizeOptionalText(input.cover.altEn),
          }
        : null,
    featured: input.featured ?? false,
    manualOrder: input.manualOrder ?? null,
  };
}

function applyNormalizedChanges(
  current: DraftRevision,
  changes: UpdateDraftInput["changes"],
): DraftContentFields {
  const merged: CreateDraftInput = {
    ...current,
    ...changes,
    cover: Object.prototype.hasOwnProperty.call(changes, "cover")
      ? changes.cover
      : current.cover,
  };

  return normalizeCreateDraft(merged);
}

function toValidationCandidate(
  fields: DraftContentFields,
  contentId: string,
) {
  return {
    id: contentId,
    slug: fields.slug,
    titleZh: fields.titleZh,
    titleEn: fields.titleEn,
    summaryZh: fields.summaryZh,
    summaryEn: fields.summaryEn,
    bodyZhMarkdown: fields.bodyZhMarkdown,
    bodyEnMarkdown: fields.bodyEnMarkdown,
    contentLanguage: fields.contentLanguage,
    primaryCategories: fields.primaryCategories,
    growthStage: fields.growthStage,
    cover: fields.cover,
  };
}

function mergeValidationResults(
  ...results: ContentValidationResult[]
): ContentValidationResult {
  const issues = results.flatMap((result) => result.issues);
  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}

const DRAFT_FIELD_KEYS = [
  "slug",
  "region",
  "contentType",
  "detailLevel",
  "growthStage",
  "titleZh",
  "titleEn",
  "summaryZh",
  "summaryEn",
  "bodyZhMarkdown",
  "bodyEnMarkdown",
  "contentLanguage",
  "primaryCategories",
  "tags",
  "cover",
  "featured",
  "manualOrder",
] as const satisfies readonly (keyof DraftContentFields)[];

const MISSING_REQUIREMENT_CODES = new Set([
  "missing_title",
  "missing_summary",
  "missing_body",
  "missing_slug",
  "missing_primary_category",
  "missing_growth_stage",
  "missing_cover_path",
  "orphaned_cover_alt",
  "missing_cover_alt",
  "missing_growth_note",
  "unresolved_relation",
]);

function assertConcurrencyToken(
  expectedLockVersion: number,
  operation:
    | "updateDraft"
    | "submitForReview"
    | "returnToDraft"
    | "publishReview",
): void {
  if (
    !Number.isSafeInteger(expectedLockVersion) ||
    expectedLockVersion < 1
  ) {
    throw new ContentMutationError("invalid_concurrency_token", operation);
  }
}

function summarizeCover(
  fields: DraftContentFields,
  issues: ContentValidationResult["issues"],
): ReviewCoverStatus {
  if (!fields.cover) {
    return { state: "absent", path: null };
  }

  if (
    issues.some(
      (issue) =>
        issue.code === "missing_cover_path" ||
        issue.code === "orphaned_cover_alt",
    )
  ) {
    return { state: "missing_path", path: fields.cover.path || null };
  }

  if (issues.some((issue) => issue.code === "missing_cover_alt")) {
    return { state: "missing_alt", path: fields.cover.path };
  }

  return { state: "ready", path: fields.cover.path };
}

function summarizeDifference(
  candidate: DraftContentFields,
  published: DraftContentFields | null,
): ReviewDifferenceSummary {
  if (!published) {
    return { kind: "new", changedFields: [] };
  }

  const changedFields = DRAFT_FIELD_KEYS.filter(
    (field) =>
      JSON.stringify(candidate[field]) !== JSON.stringify(published[field]),
  );

  return {
    kind: changedFields.length === 0 ? "unchanged" : "changed",
    changedFields,
  };
}

function buildReviewReadinessReport(
  current: DraftRevision,
  context: ReviewPreparationContext,
): ReviewReadinessReport {
  const normalizedCandidate = normalizeCreateDraft(current);
  const validationCandidate = toValidationCandidate(
    normalizedCandidate,
    current.contentId,
  );
  const relationValidation = validateContentRelations(
    context.relations,
    new Set(context.existingContentIds),
  );
  const publishedStage = context.publishedProjection?.growthStage ?? null;
  const growthStageValidation = validateGrowthStageConsistency(
    publishedStage,
    normalizedCandidate.growthStage,
    context.growthNotes,
    current.contentId,
  );
  const validation = mergeValidationResults(
    validateLifecycleTransition(current.lifecycle, "Review"),
    validateLifecycleRequirements(validationCandidate, "Review"),
    validateReviewTaxonomy({
      id: current.contentId,
      region: normalizedCandidate.region,
      contentType: normalizedCandidate.contentType,
      primaryCategories: normalizedCandidate.primaryCategories,
    }),
    validateTags(normalizedCandidate.tags, current.contentId),
    validateSlugAvailability(
      context.slugConflicts.length > 0,
      current.contentId,
    ),
    growthStageValidation,
    relationValidation,
  );
  const matchingGrowthNote = context.growthNotes.some(
    (note) =>
      note.contentId === current.contentId &&
      note.fromStage === publishedStage &&
      note.toStage === normalizedCandidate.growthStage,
  );

  return {
    ready: validation.valid,
    normalizedCandidate,
    validationIssues: validation.issues,
    missingRequirements: validation.issues.filter((issue) =>
      MISSING_REQUIREMENT_CODES.has(issue.code),
    ),
    slugConflicts: context.slugConflicts,
    coverStatus: summarizeCover(normalizedCandidate, validation.issues),
    growthStageConsistency: {
      publishedStage,
      candidateStage: normalizedCandidate.growthStage,
      changed:
        publishedStage !== null &&
        publishedStage !== normalizedCandidate.growthStage,
      hasMatchingGrowthNote:
        publishedStage === null ||
        publishedStage === normalizedCandidate.growthStage ||
        matchingGrowthNote,
    },
    relationIssues: relationValidation.issues,
    differenceFromPublished: summarizeDifference(
      normalizedCandidate,
      context.publishedProjection,
    ),
  };
}

function validatePublicationCandidate(
  current: DraftRevision,
  context: ReviewPreparationContext,
): ContentValidationResult {
  const normalizedCandidate = normalizeCreateDraft(current);
  const validationCandidate = toValidationCandidate(
    normalizedCandidate,
    current.contentId,
  );
  const publishedProjection = context.publishedProjection;

  return mergeValidationResults(
    validateLifecycleTransition(current.lifecycle, "Published"),
    validateLifecycleRequirements(validationCandidate, "Published"),
    validateReviewTaxonomy({
      id: current.contentId,
      region: normalizedCandidate.region,
      contentType: normalizedCandidate.contentType,
      primaryCategories: normalizedCandidate.primaryCategories,
    }),
    validateTags(normalizedCandidate.tags, current.contentId),
    validateSlugAvailability(
      context.slugConflicts.length > 0,
      current.contentId,
    ),
    validateStableSlug(
      publishedProjection?.slug ?? null,
      normalizedCandidate.slug,
      publishedProjection !== null,
      current.contentId,
    ),
    validateStableRegion(
      publishedProjection?.region ?? normalizedCandidate.region,
      normalizedCandidate.region,
      publishedProjection !== null,
      current.contentId,
    ),
    validateGrowthStageConsistency(
      publishedProjection?.growthStage ?? null,
      normalizedCandidate.growthStage,
      context.growthNotes,
      current.contentId,
    ),
    validateContentRelations(
      context.relations,
      new Set(context.existingContentIds),
    ),
  );
}

async function createDefaultRepository(): Promise<ContentWriteRepository> {
  const client = await createClient();
  return createContentWriteRepository(
    client as unknown as ContentWriteRepositoryClient,
  );
}

async function createDefaultArchiveRepository(): Promise<ArchiveRepository> {
  const client = await createClient();
  return createArchiveRepository(
    client as unknown as ArchiveRepositoryClient,
  );
}

export function createAdminContentService(
  dependencies: AdminContentServiceDependencies = {},
): AdminContentService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<ContentWriteRepository> | null =
    dependencies.repository
      ? Promise.resolve(dependencies.repository)
      : null;
  let archiveRepositoryPromise: Promise<ArchiveRepository> | null =
    dependencies.archiveRepository
      ? Promise.resolve(dependencies.archiveRepository)
      : null;

  function getRepository(): Promise<ContentWriteRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  function getArchiveRepository(): Promise<ArchiveRepository> {
    archiveRepositoryPromise ??=
      dependencies.archiveRepositoryFactory?.() ??
      createDefaultArchiveRepository();
    return archiveRepositoryPromise;
  }

  async function createDraft(input: CreateDraftInput): Promise<DraftRevision> {
    await authorize();
    const fields = normalizeCreateDraft(input);
    assertContentValid(
      validateLifecycleRequirements(
        toValidationCandidate(fields, "new-content"),
        "Draft",
      ),
    );

    return (await getRepository()).createDraft(fields);
  }

  async function getDraftById(
    revisionId: string,
  ): Promise<DraftRevision | null> {
    await authorize();
    return (await getRepository()).getDraftById(revisionId);
  }

  async function listDrafts(
    filters: DraftListFilters = {},
  ): Promise<DraftRevision[]> {
    await authorize();
    return (await getRepository()).listDrafts(filters);
  }

  async function updateDraft(input: UpdateDraftInput): Promise<DraftRevision> {
    await authorize();

    if (
      Object.prototype.hasOwnProperty.call(input.changes, "lifecycle")
    ) {
      assertContentValid(validateDraftLifecycleMutation());
    }

    assertConcurrencyToken(input.expectedLockVersion, "updateDraft");

    const repository = await getRepository();
    const current = await repository.getDraftRevision(
      input.contentId,
      input.revisionId,
    );
    if (!current) {
      throw new ContentMutationError("revision_not_found", "updateDraft");
    }
    if (current.lifecycle !== "Draft") {
      throw new ContentMutationError(
        "revision_not_editable",
        "updateDraft",
      );
    }

    const fields = applyNormalizedChanges(current, input.changes);
    assertContentValid(
      mergeValidationResults(
        validateLifecycleRequirements(
          toValidationCandidate(fields, current.contentId),
          "Draft",
        ),
        validateStableSlug(
          current.slug,
          fields.slug,
          current.baseContentUpdatedAt !== null,
          current.contentId,
        ),
      ),
    );

    return repository.updateDraft(
      current,
      fields,
      input.expectedLockVersion,
    );
  }

  async function getActiveRevision(
    input: PrepareReviewInput,
    operation: "prepareReview" | "submitForReview" | "returnToDraft",
  ): Promise<{ repository: ContentWriteRepository; revision: DraftRevision }> {
    const repository = await getRepository();
    const revision = await repository.getDraftRevision(
      input.contentId,
      input.revisionId,
    );
    if (!revision) {
      throw new ContentMutationError("revision_not_found", operation);
    }
    return { repository, revision };
  }

  async function prepareReview(
    input: PrepareReviewInput,
  ): Promise<ReviewReadinessReport> {
    await authorize();
    const { repository, revision } = await getActiveRevision(
      input,
      "prepareReview",
    );
    if (revision.lifecycle !== "Draft") {
      throw new ContentMutationError(
        "invalid_revision_state",
        "prepareReview",
      );
    }

    const context = await repository.getReviewPreparationContext(revision);
    return buildReviewReadinessReport(revision, context);
  }

  async function submitForReview(
    input: ReviewTransitionInput,
  ): Promise<DraftRevision> {
    await authorize();
    assertConcurrencyToken(input.expectedLockVersion, "submitForReview");
    const { repository, revision } = await getActiveRevision(
      input,
      "submitForReview",
    );
    if (revision.lifecycle !== "Draft") {
      throw new ContentMutationError(
        "invalid_revision_state",
        "submitForReview",
      );
    }

    const report = buildReviewReadinessReport(
      revision,
      await repository.getReviewPreparationContext(revision),
    );
    assertContentValid(
      report.ready
        ? { valid: true, issues: [] }
        : { valid: false, issues: report.validationIssues },
    );

    return repository.submitForReview(
      revision,
      input.expectedLockVersion,
    );
  }

  async function returnToDraft(
    input: ReviewTransitionInput,
  ): Promise<DraftRevision> {
    await authorize();
    assertConcurrencyToken(input.expectedLockVersion, "returnToDraft");
    const { repository, revision } = await getActiveRevision(
      input,
      "returnToDraft",
    );
    if (revision.lifecycle !== "Review") {
      throw new ContentMutationError(
        "invalid_revision_state",
        "returnToDraft",
      );
    }

    assertContentValid(validateLifecycleTransition("Review", "Draft"));
    return repository.returnToDraft(
      revision,
      input.expectedLockVersion,
    );
  }

  async function publishReview(
    input: PublishReviewInput,
  ): Promise<PublicationReceipt> {
    await authorize();

    let sourceMode: ContentSourceMode;
    try {
      sourceMode = dependencies.sourceMode ?? getContentSourceMode();
    } catch {
      throw new ContentMutationError("publishing_disabled", "publishReview");
    }
    if (sourceMode === "legacy") {
      throw new ContentMutationError("publishing_disabled", "publishReview");
    }

    assertConcurrencyToken(input.expectedLockVersion, "publishReview");

    const repository = await getRepository();
    const revision = await repository.getDraftRevision(
      input.contentId,
      input.revisionId,
    );

    if (revision) {
      if (revision.lifecycle !== "Review") {
        throw new ContentMutationError(
          "invalid_revision_state",
          "publishReview",
        );
      }

      if (revision.lockVersion !== input.expectedLockVersion) {
        throw new ContentMutationError("revision_conflict", "publishReview");
      }

      const context = await repository.getReviewPreparationContext(
        revision,
        "publishReview",
      );
      assertContentValid(validatePublicationCandidate(revision, context));
    }

    // A consumed Review is intentionally allowed through. The atomic RPC is
    // the only authority that can distinguish an idempotent retry from a
    // missing or conflicting publication request.
    return repository.publishReview(input);
  }

  async function archiveContent(
    input: ArchiveContentInput,
  ): Promise<ArchiveReceipt> {
    await authorize();

    if (!UUID_PATTERN.test(input.contentId)) {
      throw new ContentMutationError(
        "invalid_content_identity",
        "archiveContent",
      );
    }

    if (!UUID_PATTERN.test(input.operationId)) {
      throw new ContentMutationError(
        "invalid_operation_id",
        "archiveContent",
      );
    }

    if (
      !input.expectedUpdatedAt ||
      !Number.isFinite(Date.parse(input.expectedUpdatedAt))
    ) {
      throw new ContentMutationError(
        "invalid_concurrency_token",
        "archiveContent",
      );
    }

    let sourceMode: ContentSourceMode;
    try {
      sourceMode = dependencies.sourceMode ?? getContentSourceMode();
    } catch {
      throw new ContentMutationError("archiving_disabled", "archiveContent");
    }
    if (sourceMode === "legacy") {
      throw new ContentMutationError("archiving_disabled", "archiveContent");
    }

    return (await getArchiveRepository()).archivePublishedContent(input);
  }

  async function startDraftRevision(
    input: StartDraftRevisionInput,
  ): Promise<DraftRevision> {
    await authorize();
    const repository = await getRepository();
    const content = await repository.getContentWorkflowState(input.contentId);
    if (!content) {
      throw new ContentMutationError(
        "content_not_found",
        "startDraftRevision",
      );
    }

    assertContentValid(validateLifecycleTransition(content.lifecycle, "Draft"));
    return repository.startDraftRevision(content.contentId);
  }

  return {
    createDraft,
    getDraftById,
    listDrafts,
    updateDraft,
    prepareReview,
    submitForReview,
    returnToDraft,
    publishReview,
    archiveContent,
    startDraftRevision,
  };
}
