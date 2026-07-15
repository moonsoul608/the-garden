import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentValidationResult } from "@/lib/content/errors";
import { assertContentValid } from "@/lib/content/errors";
import {
  validateLifecycleRequirements,
  validateLifecycleTransition,
  validateDraftLifecycleMutation,
  validateStableSlug,
} from "@/lib/content/validation";

import type {
  AdminContentService,
  CreateDraftInput,
  DraftContentFields,
  DraftListFilters,
  DraftRevision,
  StartDraftRevisionInput,
  UpdateDraftInput,
} from "./contracts";
import { ContentMutationError } from "./errors";
import {
  createContentWriteRepository,
  type ContentWriteRepository,
  type ContentWriteRepositoryClient,
} from "./repository";

type AuthorizeAdminRequest = () => Promise<AuthenticatedUser>;

export type AdminContentServiceDependencies = {
  authorize?: AuthorizeAdminRequest;
  repository?: ContentWriteRepository;
  repositoryFactory?: () => Promise<ContentWriteRepository>;
};

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

async function createDefaultRepository(): Promise<ContentWriteRepository> {
  const client = await createClient();
  return createContentWriteRepository(
    client as unknown as ContentWriteRepositoryClient,
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

  function getRepository(): Promise<ContentWriteRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
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

    if (
      !Number.isSafeInteger(input.expectedLockVersion) ||
      input.expectedLockVersion < 1
    ) {
      throw new ContentMutationError(
        "invalid_concurrency_token",
        "updateDraft",
      );
    }

    const repository = await getRepository();
    const current = await repository.getDraftRevision(
      input.contentId,
      input.revisionId,
    );
    if (!current || current.lifecycle !== "Draft") {
      throw new ContentMutationError("revision_not_found", "updateDraft");
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
    startDraftRevision,
  };
}
