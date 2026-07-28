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
    return actionState("error", "That visitor note is no longer available.");
  }

  if (error instanceof VisitorNotesManagementUnavailableError) {
    return actionState(
      "error",
      "Visitor notes are temporarily unavailable. No note was changed.",
    );
  }

  return actionState(
    "error",
    "The visitor note could not be changed. No private details were exposed.",
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
    return actionState("success", "Visitor note marked read.");
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
    return actionState("success", "Visitor note marked unread.");
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
    return actionState("success", "Visitor note deleted.");
  } catch (error) {
    return safeError(error);
  }
}
