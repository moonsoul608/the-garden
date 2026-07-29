"use server";

import { revalidatePath } from "next/cache";

import {
  createVisitorNotesManagementService,
  VisitorNoteInputError,
  VisitorNotesManagementUnavailableError,
} from "@/lib/content/admin";

import type { VisitorNoteActionState } from "./action-contracts";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function actionState(
  status: VisitorNoteActionState["status"],
  message: string,
): VisitorNoteActionState {
  return { status, message };
}

function safeError(error: unknown): VisitorNoteActionState {
  if (error instanceof VisitorNoteInputError) {
    return actionState("error", "该访客留言已不可用。");
  }

  if (error instanceof VisitorNotesManagementUnavailableError) {
    return actionState(
      "error",
      "访客留言暂时不可用。没有留言被更改。",
    );
  }

  return actionState(
    "error",
    "访客留言无法更改。未显示任何内部详情。",
  );
}

function refreshVisitorNotes(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/notes");
}

export async function markVisitorNoteReadAction(
  _previousState: VisitorNoteActionState,
  formData: FormData,
): Promise<VisitorNoteActionState> {
  try {
    await createVisitorNotesManagementService().markVisitorNoteReadState({
      noteId: text(formData, "noteId"),
      isRead: true,
    });
    refreshVisitorNotes();
    return actionState("success", "访客留言已标记为已读。");
  } catch (error) {
    return safeError(error);
  }
}

export async function markVisitorNoteUnreadAction(
  _previousState: VisitorNoteActionState,
  formData: FormData,
): Promise<VisitorNoteActionState> {
  try {
    await createVisitorNotesManagementService().markVisitorNoteReadState({
      noteId: text(formData, "noteId"),
      isRead: false,
    });
    refreshVisitorNotes();
    return actionState("success", "访客留言已标记为未读。");
  } catch (error) {
    return safeError(error);
  }
}

export async function deleteVisitorNoteAction(
  _previousState: VisitorNoteActionState,
  formData: FormData,
): Promise<VisitorNoteActionState> {
  try {
    await createVisitorNotesManagementService().deleteVisitorNote({
      noteId: text(formData, "noteId"),
    });
    refreshVisitorNotes();
    return actionState("success", "访客留言已删除。");
  } catch (error) {
    return safeError(error);
  }
}
