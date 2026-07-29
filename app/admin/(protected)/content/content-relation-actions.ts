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
  return actionState("error", "Some Content Relation fields need attention.", {
    [field]: [message],
  });
}

function safeError(error: unknown): ContentRelationActionState {
  if (error instanceof ContentRelationInputError) {
    return fieldError(error.field, "Check this Content Relation field.");
  }

  if (error instanceof ContentRelationContentUnavailableError) {
    return fieldError(error.field, "That content item is unavailable.");
  }

  if (error instanceof ContentRelationDuplicateError) {
    return fieldError("targetContentId", "That relation already exists.");
  }

  if (error instanceof ContentRelationNotFoundError) {
    return actionState(
      "error",
      "That Content Relation is no longer available.",
    );
  }

  if (error instanceof ContentRelationsManagementUnavailableError) {
    return actionState(
      "error",
      "Content Relations are temporarily unavailable. No relation was changed.",
    );
  }

  return actionState(
    "error",
    "The Content Relation could not be changed. No private details were exposed.",
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
    return actionState("success", "Content Relation created.");
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
    return actionState("success", "Content Relation deleted.");
  } catch (error) {
    return safeError(error);
  }
}
