"use server";

import { revalidatePath } from "next/cache";

import {
  createGrowthNotesManagementService,
  GrowthNoteContentUnavailableError,
  GrowthNoteInputError,
  GrowthNoteNotFoundError,
  GrowthNotesManagementUnavailableError,
} from "@/lib/content/admin";
import type { GrowthStage } from "@/types";

import type { GrowthNoteActionState } from "./growth-note-action-contracts";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value || null;
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function actionState(
  status: GrowthNoteActionState["status"],
  message: string,
  fieldErrors: GrowthNoteActionState["fieldErrors"] = {},
): GrowthNoteActionState {
  return { status, message, fieldErrors };
}

function fieldError(field: string, message: string): GrowthNoteActionState {
  return actionState("error", "部分 Growth Notes 字段需要处理。", {
    [field]: [message],
  });
}

function safeError(error: unknown): GrowthNoteActionState {
  if (error instanceof GrowthNoteInputError) {
    return fieldError(error.field, "请检查这个 Growth Notes 字段。");
  }

  if (error instanceof GrowthNoteContentUnavailableError) {
    return actionState(
      "error",
      "此内容不能添加 Growth Notes。",
    );
  }

  if (error instanceof GrowthNoteNotFoundError) {
    return actionState("error", "此 Growth Notes 已不可用。");
  }

  if (error instanceof GrowthNotesManagementUnavailableError) {
    return actionState(
      "error",
      "Growth Notes 暂时不可用。没有记录被更改。",
    );
  }

  return actionState(
    "error",
    "Growth Notes 无法更改。未显示任何内部详情。",
  );
}

function editableFields(formData: FormData) {
  return {
    fromStage: optionalText(formData, "fromStage") as GrowthStage | null,
    toStage: text(formData, "toStage") as GrowthStage,
    noteZh: optionalText(formData, "noteZh"),
    noteEn: optionalText(formData, "noteEn"),
    occurredAt: text(formData, "occurredAt"),
    isPublic: checkbox(formData, "isPublic"),
  };
}

function refreshGrowthNotes(formData: FormData): void {
  const revisionId = text(formData, "revisionId");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  if (revisionId) revalidatePath(`/admin/content/${revisionId}`);
}

export async function createGrowthNoteAction(
  _previousState: GrowthNoteActionState,
  formData: FormData,
): Promise<GrowthNoteActionState> {
  try {
    await createGrowthNotesManagementService().createGrowthNote({
      contentId: text(formData, "contentId"),
      ...editableFields(formData),
    });
    refreshGrowthNotes(formData);
    return actionState("success", "Growth Notes 已创建。");
  } catch (error) {
    return safeError(error);
  }
}

export async function updateGrowthNoteAction(
  _previousState: GrowthNoteActionState,
  formData: FormData,
): Promise<GrowthNoteActionState> {
  try {
    await createGrowthNotesManagementService().updateGrowthNote({
      contentId: text(formData, "contentId"),
      noteId: text(formData, "noteId"),
      ...editableFields(formData),
    });
    refreshGrowthNotes(formData);
    return actionState("success", "Growth Notes 已更新。");
  } catch (error) {
    return safeError(error);
  }
}

export async function deleteGrowthNoteAction(
  _previousState: GrowthNoteActionState,
  formData: FormData,
): Promise<GrowthNoteActionState> {
  try {
    await createGrowthNotesManagementService().deleteGrowthNote({
      contentId: text(formData, "contentId"),
      noteId: text(formData, "noteId"),
    });
    refreshGrowthNotes(formData);
    return actionState("success", "Growth Notes 已删除。");
  } catch (error) {
    return safeError(error);
  }
}
