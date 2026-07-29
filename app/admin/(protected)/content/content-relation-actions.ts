"use server";

import { revalidatePath } from "next/cache";

import {
  ContentRelationContentUnavailableError,
  ContentRelationDuplicateError,
  ContentRelationInputError,
  ContentRelationNotFoundError,
  ContentRelationsManagementUnavailableError,
  createContentRelationsManagementService,
} from "@/lib/content/admin";
import type { RelationType } from "@/types";

import type { ContentRelationActionState } from "./content-relation-action-contracts";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value || null;
}

function actionState(
  status: ContentRelationActionState["status"],
  message: string,
  fieldErrors: ContentRelationActionState["fieldErrors"] = {},
): ContentRelationActionState {
  return { status, message, fieldErrors };
}

function fieldError(field: string, message: string): ContentRelationActionState {
  return actionState("error", "部分 Content Relations 字段需要处理。", {
    [field]: [message],
  });
}

function safeError(error: unknown): ContentRelationActionState {
  if (error instanceof ContentRelationInputError) {
    return fieldError(error.field, "请检查这个 Content Relations 字段。");
  }

  if (error instanceof ContentRelationContentUnavailableError) {
    return fieldError(error.field, "该内容不可用。");
  }

  if (error instanceof ContentRelationDuplicateError) {
    return fieldError("targetContentId", "该关系已经存在。");
  }

  if (error instanceof ContentRelationNotFoundError) {
    return actionState(
      "error",
      "该 Content Relations 已不可用。",
    );
  }

  if (error instanceof ContentRelationsManagementUnavailableError) {
    return actionState(
      "error",
      "Content Relations 暂时不可用。没有关系被更改。",
    );
  }

  return actionState(
    "error",
    "Content Relations 无法更改。未显示任何内部详情。",
  );
}

function refreshContentRelations(formData: FormData): void {
  const revisionId = text(formData, "revisionId");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  if (revisionId) revalidatePath(`/admin/content/${revisionId}`);
}

export async function createContentRelationAction(
  _previousState: ContentRelationActionState,
  formData: FormData,
): Promise<ContentRelationActionState> {
  try {
    await createContentRelationsManagementService().createRelation({
      sourceContentId: text(formData, "sourceContentId"),
      targetContentId: text(formData, "targetContentId"),
      relationType: text(formData, "relationType") as RelationType,
      noteZh: optionalText(formData, "noteZh"),
      noteEn: optionalText(formData, "noteEn"),
    });
    refreshContentRelations(formData);
    return actionState("success", "Content Relations 已创建。");
  } catch (error) {
    return safeError(error);
  }
}

export async function deleteContentRelationAction(
  _previousState: ContentRelationActionState,
  formData: FormData,
): Promise<ContentRelationActionState> {
  try {
    await createContentRelationsManagementService().deleteRelation({
      sourceContentId: text(formData, "sourceContentId"),
      relationId: text(formData, "relationId"),
    });
    refreshContentRelations(formData);
    return actionState("success", "Content Relations 已删除。");
  } catch (error) {
    return safeError(error);
  }
}
