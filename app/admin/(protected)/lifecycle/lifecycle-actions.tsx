"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type RefObject,
} from "react";

import type { LifecycleListItem } from "@/lib/content/admin";

import { INITIAL_LIFECYCLE_ACTION_STATE } from "./action-contracts";
import {
  archiveContentAction,
  deleteContentAction,
  previewDeletionAction,
  restoreContentAction,
} from "./actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function closeDialog(ref: RefObject<HTMLDialogElement | null>): void {
  ref.current?.close();
}

function openDialog(ref: RefObject<HTMLDialogElement | null>): void {
  ref.current?.showModal();
}

function Identity({ item }: Readonly<{ item: LifecycleListItem }>) {
  return (
    <div className="admin-lifecycle-identity">
      <span>{item.region}</span>
      <strong>{item.title}</strong>
      {item.canonicalRoute ? <code>{item.canonicalRoute}</code> : null}
    </div>
  );
}

function ActionNotice({
  state,
}: Readonly<{ state: typeof INITIAL_LIFECYCLE_ACTION_STATE }>) {
  if (state.status === "idle" || state.status === "preview" || !state.message) {
    return null;
  }

  return (
    <div
      className={`admin-lifecycle-notice admin-lifecycle-notice--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
    >
      <strong>{state.status === "success" ? "Tending complete" : "Unable to continue"}</strong>
      <span>{state.message}</span>
    </div>
  );
}

function ArchiveDialog({ item }: Readonly<{ item: LifecycleListItem }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const router = useRouter();
  const [actionState, action, pending] = useActionState(
    archiveContentAction,
    INITIAL_LIFECYCLE_ACTION_STATE,
  );

  useEffect(() => {
    if (actionState.status === "success") router.refresh();
  }, [actionState.status, router]);

  return (
    <>
      <button type="button" onClick={() => openDialog(dialogRef)}>
        Archive
      </button>
      <dialog
        className="admin-lifecycle-dialog"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">Archive confirmation</p>
          <h2 id={dialogTitleId}>Let this path rest?</h2>
          <Identity item={item} />
          <div className="admin-lifecycle-impact">
            <h3>What archiving changes</h3>
            <ul>
              <li>The item leaves Region collections, search, and Home curation.</li>
              <li>Its public route becomes a resting-state path.</li>
              <li>An immutable archive checkpoint preserves its current state.</li>
            </ul>
          </div>
          <p className="admin-lifecycle-dialog-note">
            The existing archive service will recheck lifecycle eligibility and
            concurrency before making any change.
          </p>
          <form action={action}>
            <input
              type="hidden"
              name="canonicalRoute"
              value={item.canonicalRoute ?? ""}
            />
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={item.concurrencyToken}
            />
            <div className="admin-lifecycle-dialog-actions">
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => closeDialog(dialogRef)}
              >
                Keep Published
              </button>
              <button
                type="submit"
                className="admin-primary-action"
                disabled={pending}
              >
                {pending ? "Archiving…" : "Confirm archive"}
              </button>
            </div>
          </form>
          <ActionNotice state={actionState} />
        </div>
      </dialog>
    </>
  );
}

function RestoreDialog({ item }: Readonly<{ item: LifecycleListItem }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const router = useRouter();
  const [actionState, action, pending] = useActionState(
    restoreContentAction,
    INITIAL_LIFECYCLE_ACTION_STATE,
  );

  useEffect(() => {
    if (actionState.status === "success") router.refresh();
  }, [actionState.status, router]);

  return (
    <>
      <button type="button" onClick={() => openDialog(dialogRef)}>
        Restore to Draft
      </button>
      <dialog
        className="admin-lifecycle-dialog"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">Restore preview</p>
          <h2 id={dialogTitleId}>Bring this archive back to the workbench?</h2>
          <Identity item={item} />
          <dl className="admin-lifecycle-preview-grid">
            <div>
              <dt>Source archive</dt>
              <dd>
                {item.sourceArchiveAt ? (
                  <time dateTime={item.sourceArchiveAt}>
                    Protected {dateFormatter.format(new Date(item.sourceArchiveAt))}
                  </time>
                ) : (
                  "Archive checkpoint unavailable"
                )}
              </dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>One private Draft, ready for editing and Review</dd>
            </div>
          </dl>
          <div className="admin-lifecycle-impact">
            <h3>What remains protected</h3>
            <ul>
              <li>The selected archive remains the Draft&apos;s source provenance.</li>
              <li>The Archived projection continues resting until a later Review is published.</li>
              <li>The archive timestamp is rechecked with optimistic locking.</li>
            </ul>
          </div>
          <form action={action}>
            <input
              type="hidden"
              name="canonicalRoute"
              value={item.canonicalRoute ?? ""}
            />
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={item.concurrencyToken}
            />
            <div className="admin-lifecycle-dialog-actions">
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => closeDialog(dialogRef)}
              >
                Leave Archived
              </button>
              <button
                type="submit"
                className="admin-primary-action"
                disabled={pending || !item.sourceArchiveAt}
              >
                {pending ? "Restoring…" : "Create private Draft"}
              </button>
            </div>
          </form>
          <ActionNotice state={actionState} />
        </div>
      </dialog>
    </>
  );
}

function DeleteDialog({ item }: Readonly<{ item: LifecycleListItem }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const confirmationId = useId();
  const router = useRouter();
  const [previewState, previewAction, previewPending] = useActionState(
    previewDeletionAction,
    INITIAL_LIFECYCLE_ACTION_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteContentAction,
    INITIAL_LIFECYCLE_ACTION_STATE,
  );
  const preview = previewState.preview;

  useEffect(() => {
    if (deleteState.status === "success") router.refresh();
  }, [deleteState.status, router]);

  return (
    <>
      <button
        type="button"
        className="admin-destructive-action"
        onClick={() => openDialog(dialogRef)}
      >
        Delete permanently
      </button>
      <dialog
        className="admin-lifecycle-dialog admin-lifecycle-dialog--danger"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">Destructive action</p>
          <h2 id={dialogTitleId}>Permanently remove this garden record?</h2>
          <Identity item={item} />

          {!preview ? (
            <>
              <div className="admin-lifecycle-warning" role="note">
                <strong>This cannot be undone.</strong>
                <span>
                  Prepare a fresh server preview before the final confirmation.
                </span>
              </div>
              <form action={previewAction}>
                <input
                  type="hidden"
                  name="canonicalRoute"
                  value={item.canonicalRoute ?? ""}
                />
                <div className="admin-lifecycle-dialog-actions">
                  <button
                    type="button"
                    className="admin-secondary-action"
                    onClick={() => closeDialog(dialogRef)}
                  >
                    Leave Archived
                  </button>
                  <button type="submit" disabled={previewPending}>
                    {previewPending ? "Preparing impact…" : "Preview deletion impact"}
                  </button>
                </div>
              </form>
              <ActionNotice state={previewState} />
            </>
          ) : (
            <>
              <div className="admin-deletion-preview" aria-live="polite">
                <section>
                  <h3>Affected routes</h3>
                  <ul>
                    {preview.affectedRoutes.map((route) => (
                      <li key={route}><code>{route}</code></li>
                    ))}
                  </ul>
                  <p>{preview.redirectReferenceCount} redirect references are included.</p>
                </section>
                <section>
                  <h3>Relation impact</h3>
                  <p>
                    {preview.inboundRelationCount} inbound and{" "}
                    {preview.outboundRelationCount} outbound live relations will be removed.
                  </p>
                </section>
                <section>
                  <h3>Version preservation</h3>
                  <p>
                    {preview.versionCount} historical versions remain protected and are not deleted.
                  </p>
                </section>
                <section>
                  <h3>Storage behavior</h3>
                  <p>
                    {preview.storageReferenceCount} Storage references are recorded.
                    Storage objects are NOT immediately deleted.
                  </p>
                </section>
              </div>
              <div className="admin-lifecycle-warning" role="alert">
                <strong>Irreversible live-record deletion</strong>
                <span>
                  Routes become terminal and the live projection cannot be restored.
                  Historical versions remain protected.
                </span>
              </div>
              <form className="admin-delete-confirmation" action={deleteAction}>
                <input
                  type="hidden"
                  name="canonicalRoute"
                  value={item.canonicalRoute ?? ""}
                />
                <input
                  type="hidden"
                  name="expectedArchivedToken"
                  value={preview.expectedArchivedToken}
                />
                <input
                  type="hidden"
                  name="impactDigest"
                  value={preview.impactDigest}
                />
                <label htmlFor={confirmationId}>
                  Type <strong>DELETE</strong> to confirm
                </label>
                <input
                  id={confirmationId}
                  name="deleteConfirmation"
                  autoComplete="off"
                  required
                  pattern="DELETE"
                />
                <div className="admin-lifecycle-dialog-actions">
                  <button
                    type="button"
                    className="admin-secondary-action"
                    onClick={() => closeDialog(dialogRef)}
                  >
                    Keep this archive
                  </button>
                  <button
                    type="submit"
                    className="admin-destructive-confirmation"
                    disabled={deletePending}
                  >
                    {deletePending ? "Removing record…" : "Delete permanently"}
                  </button>
                </div>
              </form>
              <ActionNotice state={deleteState} />
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

export function LifecycleActions({
  item,
}: Readonly<{ item: LifecycleListItem }>) {
  if (!item.canonicalRoute) {
    return <span className="admin-lifecycle-action-note">Public route unavailable</span>;
  }

  if (item.workspaceState) {
    return (
      <span className="admin-lifecycle-action-note">
        {item.workspaceState} work is active
      </span>
    );
  }

  return (
    <div className="admin-lifecycle-actions">
      {item.lifecycle === "Published" ? (
        <ArchiveDialog item={item} />
      ) : (
        <>
          <RestoreDialog item={item} />
          <DeleteDialog item={item} />
        </>
      )}
    </div>
  );
}
