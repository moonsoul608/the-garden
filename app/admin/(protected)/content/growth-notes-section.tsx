"use client";

import { useActionState } from "react";

import type { GrowthNoteListItem } from "@/lib/content/admin";
import type { GrowthStage } from "@/types";

import {
  createGrowthNoteAction,
  deleteGrowthNoteAction,
  updateGrowthNoteAction,
} from "./growth-note-actions";
import {
  INITIAL_GROWTH_NOTE_ACTION_STATE,
  type GrowthNoteActionState,
} from "./growth-note-action-contracts";

const GROWTH_STAGES = [
  "Seed",
  "Sprout",
  "Growing",
  "Bloom",
  "Dormant",
] as const satisfies readonly GrowthStage[];

function datetimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowDatetimeLocal(): string {
  return datetimeLocalValue(new Date().toISOString());
}

function FieldError({
  state,
  field,
}: Readonly<{ state: GrowthNoteActionState; field: string }>) {
  const errors = state.fieldErrors[field];
  if (!errors?.length) return null;

  return (
    <span className="admin-field-error" id={`growth-note-${field}-error`}>
      {errors.join(" ")}
    </span>
  );
}

function ActionNotice({
  state,
}: Readonly<{ state: GrowthNoteActionState }>) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <p
      className={`admin-growth-note-status admin-growth-note-status--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

function StageSelect({
  name,
  defaultValue,
  allowEmpty = false,
}: Readonly<{
  name: "fromStage" | "toStage";
  defaultValue?: GrowthStage | null;
  allowEmpty?: boolean;
}>) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""}>
      {allowEmpty ? <option value="">No previous stage</option> : null}
      {GROWTH_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {stage}
        </option>
      ))}
    </select>
  );
}

function HiddenIdentity({
  contentId,
  revisionId,
  noteId,
}: Readonly<{
  contentId: string;
  revisionId: string;
  noteId?: string;
}>) {
  return (
    <>
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
    </>
  );
}

function NoteFields({
  note,
  state,
}: Readonly<{ note?: GrowthNoteListItem; state: GrowthNoteActionState }>) {
  return (
    <>
      <div className="admin-form-grid admin-form-grid--four">
        <label className="admin-form-field">
          <span>From stage</span>
          <StageSelect
            name="fromStage"
            defaultValue={note?.fromStage ?? null}
            allowEmpty
          />
        </label>
        <label className="admin-form-field">
          <span>To stage</span>
          <StageSelect name="toStage" defaultValue={note?.toStage ?? "Seed"} />
        </label>
        <label className="admin-form-field">
          <span>Occurred at</span>
          <input
            name="occurredAt"
            type="datetime-local"
            defaultValue={
              note ? datetimeLocalValue(note.occurredAt) : nowDatetimeLocal()
            }
          />
        </label>
        <label className="admin-form-field admin-checkbox-field">
          <span>Visibility</span>
          <span className="admin-checkbox-control">
            <input
              name="isPublic"
              type="checkbox"
              defaultChecked={note?.isPublic ?? false}
            />
            Public timeline
          </span>
        </label>
      </div>
      <FieldError state={state} field="fromStage" />
      <FieldError state={state} field="toStage" />
      <FieldError state={state} field="occurredAt" />

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>Chinese note</span>
          <textarea
            name="noteZh"
            rows={4}
            lang="zh"
            defaultValue={note?.noteZh ?? ""}
          />
        </label>
        <label className="admin-form-field">
          <span>English note</span>
          <textarea name="noteEn" rows={4} defaultValue={note?.noteEn ?? ""} />
        </label>
      </div>
      <FieldError state={state} field="growthNote" />
    </>
  );
}

function CreateGrowthNoteForm({
  contentId,
  revisionId,
}: Readonly<{ contentId: string; revisionId: string }>) {
  const [state, action, pending] = useActionState(
    createGrowthNoteAction,
    INITIAL_GROWTH_NOTE_ACTION_STATE,
  );

  return (
    <form className="admin-growth-note-form" action={action}>
      <HiddenIdentity contentId={contentId} revisionId={revisionId} />
      <NoteFields state={state} />
      <div className="admin-growth-note-actions">
        <button className="admin-primary-action" type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Growth Note"}
        </button>
        <ActionNotice state={state} />
      </div>
    </form>
  );
}

function ExistingGrowthNoteForm({
  contentId,
  revisionId,
  note,
}: Readonly<{
  contentId: string;
  revisionId: string;
  note: GrowthNoteListItem;
}>) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateGrowthNoteAction,
    INITIAL_GROWTH_NOTE_ACTION_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGrowthNoteAction,
    INITIAL_GROWTH_NOTE_ACTION_STATE,
  );

  return (
    <article className="admin-growth-note-card">
      <form className="admin-growth-note-form" action={updateAction}>
        <HiddenIdentity
          contentId={contentId}
          revisionId={revisionId}
          noteId={note.id}
        />
        <NoteFields note={note} state={updateState} />
        <div className="admin-growth-note-actions">
          <button
            className="admin-primary-action"
            type="submit"
            disabled={updatePending}
          >
            {updatePending ? "Updating..." : "Update"}
          </button>
          <ActionNotice state={updateState} />
        </div>
      </form>

      <form className="admin-growth-note-delete" action={deleteAction}>
        <HiddenIdentity
          contentId={contentId}
          revisionId={revisionId}
          noteId={note.id}
        />
        <button
          className="admin-destructive-action"
          type="submit"
          disabled={deletePending}
        >
          {deletePending ? "Deleting..." : "Delete"}
        </button>
        <ActionNotice state={deleteState} />
      </form>
    </article>
  );
}

export function GrowthNotesSection({
  contentId,
  revisionId,
  notes,
}: Readonly<{
  contentId: string;
  revisionId: string;
  notes: readonly GrowthNoteListItem[];
}>) {
  return (
    <section className="admin-editor-section admin-growth-notes-section" aria-labelledby="growth-notes-title">
      <div className="admin-editor-section-heading">
        <p>04</p>
        <div>
          <h2 id="growth-notes-title">Growth Notes</h2>
          <span>Notes here support Growth Stage changes and public timeline visibility.</span>
        </div>
      </div>

      <div className="admin-growth-notes-workspace">
        <CreateGrowthNoteForm contentId={contentId} revisionId={revisionId} />

        {notes.length > 0 ? (
          <div className="admin-growth-note-list">
            {notes.map((note) => (
              <ExistingGrowthNoteForm
                key={note.id}
                contentId={contentId}
                revisionId={revisionId}
                note={note}
              />
            ))}
          </div>
        ) : (
          <p className="admin-growth-note-empty">
            No Growth Notes yet.
          </p>
        )}
      </div>
    </section>
  );
}
