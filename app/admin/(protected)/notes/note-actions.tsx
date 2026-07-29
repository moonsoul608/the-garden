"use client";

import { useActionState } from "react";

import type { VisitorNoteListItem } from "@/lib/content/admin";

import {
  deleteVisitorNoteAction,
  markVisitorNoteReadAction,
  markVisitorNoteUnreadAction,
} from "./actions";
import { INITIAL_VISITOR_NOTE_ACTION_STATE } from "./action-contracts";

function ActionNotice({
  state,
}: Readonly<{ state: typeof INITIAL_VISITOR_NOTE_ACTION_STATE }>) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <p
      className={`admin-note-action-status admin-note-action-status--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

export function NoteActions({
  note,
}: Readonly<{ note: VisitorNoteListItem }>) {
  const [readState, readAction, readPending] = useActionState(
    markVisitorNoteReadAction,
    INITIAL_VISITOR_NOTE_ACTION_STATE,
  );
  const [unreadState, unreadAction, unreadPending] = useActionState(
    markVisitorNoteUnreadAction,
    INITIAL_VISITOR_NOTE_ACTION_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteVisitorNoteAction,
    INITIAL_VISITOR_NOTE_ACTION_STATE,
  );

  return (
    <div className="admin-note-actions">
      {note.status === "unread" ? (
        <form action={readAction}>
          <input type="hidden" name="noteId" value={note.id} />
          <button type="submit" disabled={readPending}>
            {readPending ? "标记中..." : "标记为已读"}
          </button>
          <ActionNotice state={readState} />
        </form>
      ) : (
        <form action={unreadAction}>
          <input type="hidden" name="noteId" value={note.id} />
          <button type="submit" disabled={unreadPending}>
            {unreadPending ? "标记中..." : "标记为未读"}
          </button>
          <ActionNotice state={unreadState} />
        </form>
      )}

      <form action={deleteAction}>
        <input type="hidden" name="noteId" value={note.id} />
        <button
          type="submit"
          className="admin-destructive-action"
          disabled={deletePending}
        >
          {deletePending ? "删除中..." : "删除"}
        </button>
        <ActionNotice state={deleteState} />
      </form>
    </div>
  );
}
