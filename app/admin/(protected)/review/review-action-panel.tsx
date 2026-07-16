"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import type { DraftRevision } from "@/lib/content/admin";

import { INITIAL_REVIEW_ACTION_STATE } from "./action-contracts";
import {
  publishReviewAction,
  returnToDraftAction,
  submitForReviewAction,
} from "./actions";

function RevisionFields({ revision }: Readonly<{ revision: DraftRevision }>) {
  return (
    <>
      <input type="hidden" name="contentId" value={revision.contentId} />
      <input type="hidden" name="revisionId" value={revision.revisionId} />
      <input
        type="hidden"
        name="expectedLockVersion"
        value={revision.lockVersion}
      />
    </>
  );
}

function ActionNotice({
  state,
}: Readonly<{
  state: typeof INITIAL_REVIEW_ACTION_STATE;
}>) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <div
      className={`admin-review-notice admin-review-notice--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
    >
      <strong>{state.status === "success" ? "Done" : "Unable to continue"}</strong>
      <span>{state.message}</span>
      {state.publishedAt ? (
        <time dateTime={state.publishedAt}>
          Published {new Date(state.publishedAt).toLocaleString()}
        </time>
      ) : null}
      {state.status !== "success" && state.destination ? (
        <Link href={state.destination}>Return to the Review queue</Link>
      ) : null}
    </div>
  );
}

export function ReviewActionPanel({
  revision,
  ready,
}: Readonly<{ revision: DraftRevision; ready: boolean }>) {
  const router = useRouter();
  const [submitState, submitAction, submitPending] = useActionState(
    submitForReviewAction,
    INITIAL_REVIEW_ACTION_STATE,
  );
  const [returnState, returnAction, returnPending] = useActionState(
    returnToDraftAction,
    INITIAL_REVIEW_ACTION_STATE,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishReviewAction,
    INITIAL_REVIEW_ACTION_STATE,
  );

  useEffect(() => {
    if (submitState.status === "success") router.refresh();
  }, [router, submitState.status]);

  useEffect(() => {
    if (returnState.status === "success" && returnState.destination) {
      router.push(returnState.destination);
    }
  }, [returnState.destination, returnState.status, router]);

  if (revision.lifecycle === "Draft") {
    return (
      <section className="admin-review-actions" aria-labelledby="review-action-title">
        <div>
          <p className="admin-section-kicker">Next step</p>
          <h2 id="review-action-title">Move this Draft to the Review bench</h2>
          <span>
            The server will prepare the readiness report again before changing
            the lifecycle.
          </span>
        </div>
        <form action={submitAction}>
          <RevisionFields revision={revision} />
          <button
            className="admin-primary-action"
            type="submit"
            disabled={submitPending || !ready}
          >
            {submitPending ? "Checking…" : "Submit for Review"}
          </button>
        </form>
        <ActionNotice state={submitState} />
      </section>
    );
  }

  return (
    <section className="admin-review-actions" aria-labelledby="review-action-title">
      <div>
        <p className="admin-section-kicker">Decision bench</p>
        <h2 id="review-action-title">Choose the next path</h2>
        <span>
          Return the work for more tending, or publish through the existing
          atomic publishing service.
        </span>
      </div>

      <div className="admin-review-action-grid">
        <form className="admin-review-return-form" action={returnAction}>
          <RevisionFields revision={revision} />
          <label htmlFor="return-reason">Reason for returning to Draft</label>
          <textarea
            id="return-reason"
            name="reason"
            rows={4}
            maxLength={1000}
            required
            placeholder="What needs another pass?"
          />
          <small>The Keeper identity is supplied by the server.</small>
          <button type="submit" disabled={returnPending}>
            {returnPending ? "Returning…" : "Return to Draft"}
          </button>
          <ActionNotice state={returnState} />
        </form>

        <form className="admin-review-publish-form" action={publishAction}>
          <RevisionFields revision={revision} />
          <details>
            <summary>Confirm publish</summary>
            <p>
              Publishing updates the public projection and records a version
              snapshot atomically.
            </p>
            <label>
              <input
                type="checkbox"
                name="publishConfirmation"
                value="confirmed"
                required
              />
              <span>I reviewed the checklist and want to publish this revision.</span>
            </label>
            <button
              className="admin-primary-action"
              type="submit"
              disabled={publishPending || !ready}
            >
              {publishPending ? "Publishing…" : "Publish to the garden"}
            </button>
          </details>
          <ActionNotice state={publishState} />
        </form>
      </div>
    </section>
  );
}
