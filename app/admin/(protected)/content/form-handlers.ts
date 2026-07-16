import "server-only";

import type {
  AdminContentService,
  CreateDraftInput,
  DraftContentFields,
} from "@/lib/content/admin";
import { ContentMutationError } from "@/lib/content/admin";
import { ContentValidationError } from "@/lib/content/errors";

import type { ContentFormState } from "./form-contracts";

type ContentFormService = Pick<
  AdminContentService,
  "createDraft" | "updateDraft"
>;

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function requiredText(formData: FormData, key: string): string {
  return optionalText(formData, key) ?? "";
}

function textList(formData: FormData, key: string): string[] {
  return requiredText(formData, key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function editableFields(formData: FormData): CreateDraftInput {
  return {
    slug: optionalText(formData, "slug"),
    region: requiredText(formData, "region") as CreateDraftInput["region"],
    contentType: requiredText(
      formData,
      "contentType",
    ) as CreateDraftInput["contentType"],
    detailLevel: requiredText(
      formData,
      "detailLevel",
    ) as CreateDraftInput["detailLevel"],
    growthStage: requiredText(
      formData,
      "growthStage",
    ) as CreateDraftInput["growthStage"],
    titleZh: optionalText(formData, "titleZh"),
    titleEn: optionalText(formData, "titleEn"),
    summaryZh: optionalText(formData, "summaryZh"),
    summaryEn: optionalText(formData, "summaryEn"),
    bodyZhMarkdown: optionalText(formData, "bodyZhMarkdown"),
    bodyEnMarkdown: optionalText(formData, "bodyEnMarkdown"),
    contentLanguage: requiredText(
      formData,
      "contentLanguage",
    ) as CreateDraftInput["contentLanguage"],
    primaryCategories: textList(formData, "primaryCategories"),
    tags: textList(formData, "tags"),
  };
}

function validationState(error: ContentValidationError): ContentFormState {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.field ?? "form";
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return {
    status: "error",
    message: "Some fields need attention before this Draft can be saved.",
    fieldErrors,
    revisionId: null,
    lockVersion: null,
    updatedAt: null,
  };
}

function mutationState(error: ContentMutationError): ContentFormState {
  if (error.code === "revision_conflict") {
    return {
      status: "conflict",
      message:
        "This Draft changed after the editor was opened. Reload it before saving again.",
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    };
  }

  return {
    status: "error",
    message: error.message,
    fieldErrors: {},
    revisionId: null,
    lockVersion: null,
    updatedAt: null,
  };
}

function unknownFailureState(): ContentFormState {
  return {
    status: "error",
    message: "The Draft could not be saved. Try again without leaving this page.",
    fieldErrors: {},
    revisionId: null,
    lockVersion: null,
    updatedAt: null,
  };
}

function safelyMapError(error: unknown): ContentFormState {
  if (error instanceof ContentValidationError) return validationState(error);
  if (error instanceof ContentMutationError) return mutationState(error);
  return unknownFailureState();
}

export function createContentFormHandlers(service: ContentFormService) {
  async function createDraft(
    _previousState: ContentFormState,
    formData: FormData,
  ): Promise<ContentFormState> {
    try {
      const revision = await service.createDraft(editableFields(formData));
      return {
        status: "success",
        message: "Draft created.",
        fieldErrors: {},
        revisionId: revision.revisionId,
        lockVersion: revision.lockVersion,
        updatedAt: revision.updatedAt,
      };
    } catch (error) {
      return safelyMapError(error);
    }
  }

  async function saveDraft(
    _previousState: ContentFormState,
    formData: FormData,
  ): Promise<ContentFormState> {
    try {
      const contentId = requiredText(formData, "contentId");
      const revisionId = requiredText(formData, "revisionId");
      const expectedLockVersion = Number(
        requiredText(formData, "expectedLockVersion"),
      );
      const revision = await service.updateDraft({
        contentId,
        revisionId,
        expectedLockVersion,
        changes: editableFields(formData) as Partial<DraftContentFields>,
      });

      return {
        status: "success",
        message: "Draft saved.",
        fieldErrors: {},
        revisionId: revision.revisionId,
        lockVersion: revision.lockVersion,
        updatedAt: revision.updatedAt,
      };
    } catch (error) {
      return safelyMapError(error);
    }
  }

  return { createDraft, saveDraft };
}
