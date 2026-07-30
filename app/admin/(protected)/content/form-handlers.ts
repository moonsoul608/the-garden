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

function selectFieldDiagnostics(fields: Pick<
  CreateDraftInput,
  "region" | "contentType" | "detailLevel" | "growthStage"
>) {
  return {
    region: fields.region,
    contentType: fields.contentType,
    detailLevel: fields.detailLevel,
    growthStage: fields.growthStage,
  };
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
    growthStage: optionalText(
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
    message: "保存失败：内容校验未通过。",
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
        "保存失败：当前内容状态已发生变化，请刷新后重试。",
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    };
  }

  if (
    error.code === "revision_not_editable" ||
    error.code === "invalid_revision_state" ||
    error.code === "revision_not_found" ||
    error.code === "invalid_concurrency_token"
  ) {
    return {
      status: "error",
      message: "保存失败：当前内容状态已发生变化，请刷新后重试。",
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    };
  }

  if (error.code === "mutation_denied") {
    return {
      status: "error",
      message: "保存失败：没有权限更新内容。",
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    };
  }

  if (error.code === "repository_failure") {
    return {
      status: "error",
      message: "保存失败：服务器未能完成内容更新。",
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    };
  }

  return {
    status: "error",
    message: `保存失败：${error.message}`,
    fieldErrors: {},
    revisionId: null,
    lockVersion: null,
    updatedAt: null,
  };
}

function unknownFailureState(): ContentFormState {
  return {
    status: "error",
    message: "保存失败：服务器未能完成内容更新。",
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

function logSaveFailure(
  operation: "createDraft" | "updateDraft",
  error: unknown,
  context: Record<string, string | number | null>,
): void {
  console.error("[admin-content-form] save failed", {
    operation,
    ...context,
    error,
  });
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
        message: "草稿已创建。",
        fieldErrors: {},
        revisionId: revision.revisionId,
        lockVersion: revision.lockVersion,
        updatedAt: revision.updatedAt,
      };
    } catch (error) {
      logSaveFailure("createDraft", error, {
        contentId: null,
        revisionId: null,
      });
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
      const changes = editableFields(formData) as Partial<DraftContentFields>;
      console.info("[admin-content-form] updateDraft select payload", {
        source: "formData",
        contentId,
        revisionId,
        expectedLockVersion,
        selectFields: selectFieldDiagnostics(changes as CreateDraftInput),
      });
      const revision = await service.updateDraft({
        contentId,
        revisionId,
        expectedLockVersion,
        changes,
      });

      return {
        status: "success",
        message: "草稿已保存。",
        fieldErrors: {},
        revisionId: revision.revisionId,
        lockVersion: revision.lockVersion,
        updatedAt: revision.updatedAt,
      };
    } catch (error) {
      logSaveFailure("updateDraft", error, {
        contentId:
          typeof formData.get("contentId") === "string"
            ? String(formData.get("contentId"))
            : null,
        revisionId:
          typeof formData.get("revisionId") === "string"
            ? String(formData.get("revisionId"))
            : null,
        expectedLockVersion: Number(
          typeof formData.get("expectedLockVersion") === "string"
            ? formData.get("expectedLockVersion")
            : NaN,
        ),
      });
      return safelyMapError(error);
    }
  }

  return { createDraft, saveDraft };
}
