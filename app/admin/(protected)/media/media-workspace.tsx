"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import type {
  MediaDraftTarget,
  MediaObjectItem,
  MediaReferenceStatus,
} from "@/lib/content/admin";

import type { MediaActionState } from "./action-contracts";
import { INITIAL_MEDIA_ACTION_STATE } from "./action-contracts";

type MediaWorkspaceProps = Readonly<{
  media: readonly MediaObjectItem[];
  draftTargets: readonly MediaDraftTarget[];
  action: (
    state: MediaActionState,
    formData: FormData,
  ) => Promise<MediaActionState>;
}>;

const STATUS_LABELS: Record<MediaReferenceStatus, string> = {
  Referenced: "Referenced",
  Unreferenced: "Unreferenced",
  QuarantineCandidate: "Quarantine candidate",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function UploadButton({ disabled }: Readonly<{ disabled: boolean }>) {
  const { pending } = useFormStatus();

  return (
    <div className="admin-media-upload-submit">
      <button
        className="admin-primary-action"
        type="submit"
        disabled={disabled || pending}
      >
        {pending ? "Storing cover…" : "Store and attach cover"}
      </button>
      {pending ? (
        <div className="admin-media-progress" role="status" aria-live="polite">
          <span>Carrying the cover into the seed library.</span>
          <span className="admin-media-progress-track" aria-hidden="true">
            <span />
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: Readonly<{ status: MediaReferenceStatus }>) {
  return (
    <span
      className={`admin-media-status admin-media-status--${status.toLocaleLowerCase()}`}
    >
      <span aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function MediaWorkspace({
  media,
  draftTargets,
  action,
}: MediaWorkspaceProps) {
  const [selectedPath, setSelectedPath] = useState(media[0]?.objectPath ?? "");
  const [selectedRevisionId, setSelectedRevisionId] = useState(
    draftTargets[0]?.revisionId ?? "",
  );
  const [state, formAction] = useActionState(
    action,
    INITIAL_MEDIA_ACTION_STATE,
  );
  const selectedMedia = useMemo(
    () => media.find((item) => item.objectPath === selectedPath) ?? media[0],
    [media, selectedPath],
  );
  const selectedDraft = useMemo(
    () =>
      draftTargets.find((draft) => draft.revisionId === selectedRevisionId) ??
      draftTargets[0],
    [draftTargets, selectedRevisionId],
  );

  return (
    <div className="admin-media-workspace">
      <section className="admin-media-upload" aria-labelledby="media-upload-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">Greenhouse intake</p>
            <h2 id="media-upload-title">Prepare a Draft cover</h2>
          </div>
          <span className="admin-media-limit">JPEG · PNG · WebP · 5 MiB max</span>
        </div>

        {draftTargets.length > 0 ? (
          <form className="admin-media-upload-form" action={formAction}>
            <input
              type="hidden"
              name="contentId"
              value={selectedDraft?.contentId ?? ""}
            />
            <input
              type="hidden"
              name="revisionId"
              value={selectedDraft?.revisionId ?? ""}
            />
            <input
              type="hidden"
              name="expectedLockVersion"
              value={selectedDraft?.lockVersion ?? ""}
            />

            <label className="admin-form-field">
              <span>Draft bed</span>
              <select
                value={selectedDraft?.revisionId ?? ""}
                onChange={(event) => setSelectedRevisionId(event.target.value)}
              >
                {draftTargets.map((draft) => (
                  <option key={draft.revisionId} value={draft.revisionId}>
                    {draft.title} · change {draft.lockVersion}
                  </option>
                ))}
              </select>
              <small>
                {selectedDraft?.currentCoverPath
                  ? "This replaces the Draft reference only; the old object stays preserved."
                  : "This Draft does not have a cover yet."}
              </small>
            </label>

            <label className="admin-form-field admin-media-file-field">
              <span>Cover file</span>
              <input
                name="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
              <small>File metadata is checked again on the server before Storage.</small>
            </label>

            <UploadButton disabled={!selectedDraft} />
          </form>
        ) : (
          <div className="admin-inline-empty">
            <p>No Draft bed is ready for a cover.</p>
            <span>Create or return content to Draft before attaching media.</span>
          </div>
        )}

        {state.message ? (
          <div
            className={`admin-form-notice admin-form-notice--${state.status}`}
            role={state.status === "success" ? "status" : "alert"}
            aria-live="polite"
          >
            <strong>{state.status === "success" ? "Cover tended" : "Upload paused"}</strong>
            <span>{state.message}</span>
          </div>
        ) : null}
      </section>

      <section className="admin-media-library" aria-labelledby="media-library-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">Seed library</p>
            <h2 id="media-library-title">Cover shelves</h2>
          </div>
          <p className="admin-content-count">
            {media.length} {media.length === 1 ? "object" : "objects"}
          </p>
        </div>

        {media.length > 0 && selectedMedia ? (
          <div className="admin-media-library-grid">
            <ul className="admin-media-shelves" aria-label="Cover objects">
              {media.map((item) => (
                <li key={`${item.bucket}/${item.objectPath}`}>
                  <button
                    type="button"
                    className="admin-media-shelf"
                    aria-pressed={item.objectPath === selectedMedia.objectPath}
                    onClick={() => setSelectedPath(item.objectPath)}
                  >
                    <span className="admin-media-seed-packet" aria-hidden="true">
                      {item.mimeType === "image/png"
                        ? "PNG"
                        : item.mimeType === "image/webp"
                          ? "WEBP"
                          : "IMG"}
                    </span>
                    <span className="admin-media-shelf-copy">
                      <strong>{item.displayName}</strong>
                      <small>
                        {formatBytes(item.sizeBytes)} · {item.referencedContentCount}{" "}
                        content use{item.referencedContentCount === 1 ? "" : "s"}
                      </small>
                    </span>
                    <StatusBadge status={item.referenceStatus} />
                  </button>
                </li>
              ))}
            </ul>

            <aside className="admin-media-inspector" aria-labelledby="media-inspector-title">
              <p className="admin-section-kicker">Selected packet</p>
              <h3 id="media-inspector-title">{selectedMedia.displayName}</h3>
              <StatusBadge status={selectedMedia.referenceStatus} />

              <dl>
                <div>
                  <dt>Object path</dt>
                  <dd><code>{selectedMedia.objectPath}</code></dd>
                </div>
                <div>
                  <dt>Bucket</dt>
                  <dd>{selectedMedia.bucket}</dd>
                </div>
                <div>
                  <dt>Referenced content</dt>
                  <dd>{selectedMedia.referencedContentCount}</dd>
                </div>
                <div>
                  <dt>Total references</dt>
                  <dd>{selectedMedia.referenceCount}</dd>
                </div>
                <div>
                  <dt>Usage</dt>
                  <dd>
                    {selectedMedia.projectionReferenceCount} live ·{" "}
                    {selectedMedia.revisionReferenceCount} workspace ·{" "}
                    {selectedMedia.versionReferenceCount} history
                  </dd>
                </div>
                <div>
                  <dt>Lifecycle state</dt>
                  <dd>{selectedMedia.lifecycleState}</dd>
                </div>
                <div>
                  <dt>Storage presence</dt>
                  <dd>
                    {selectedMedia.physicalObjectExists
                      ? "Object present"
                      : "Reference only"}
                  </dd>
                </div>
              </dl>

              <p className="admin-media-safety-note">
                Quarantine labels are awareness only. This workspace cannot purge or delete Storage objects.
              </p>
            </aside>
          </div>
        ) : (
          <div className="admin-content-empty">
            <span aria-hidden="true">籽</span>
            <h3>The cover shelves are empty.</h3>
            <p>Uploaded Draft covers and preserved references will gather here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
