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
      <strong>{state.status === "success" ? "已完成" : "无法继续"}</strong>
      <span>{state.message}</span>
      {state.publishedAt ? (
        <time dateTime={state.publishedAt}>
          已发布 {new Date(state.publishedAt).toLocaleString()}
        </time>
      ) : null}
      {state.status !== "success" && state.destination ? (
        <Link href={state.destination}>返回审核队列</Link>
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
    if (submitState.status === "success" && submitState.destination) {
      router.push(submitState.destination);
    }
  }, [router, submitState.destination, submitState.status]);

  useEffect(() => {
    if (returnState.status === "success" && returnState.destination) {
      router.push(returnState.destination);
    }
  }, [returnState.destination, returnState.status, router]);

  if (revision.lifecycle === "Draft") {
    return (
      <section className="admin-review-actions" aria-labelledby="review-action-title">
        <div>
          <p className="admin-section-kicker">下一步</p>
          <h2 id="review-action-title">将此草稿提交审核</h2>
          <span>
            服务器会在更改生命周期前再次生成准备情况报告。
          </span>
        </div>
        <form action={submitAction}>
          <RevisionFields revision={revision} />
          <button
            className="admin-primary-action"
            type="submit"
            disabled={submitPending || !ready}
          >
            {submitPending ? "检查中…" : "提交审核"}
          </button>
        </form>
        <ActionNotice state={submitState} />
      </section>
    );
  }

  return (
    <section className="admin-review-actions" aria-labelledby="review-action-title">
      <div>
        <p className="admin-section-kicker">审核决策</p>
        <h2 id="review-action-title">选择下一步</h2>
        <span>
          可以退回草稿继续编辑，或通过现有原子发布服务发布。
        </span>
      </div>

      <div className="admin-review-action-grid">
        <form className="admin-review-return-form" action={returnAction}>
          <RevisionFields revision={revision} />
          <label htmlFor="return-reason">退回草稿原因</label>
          <textarea
            id="return-reason"
            name="reason"
            rows={4}
            maxLength={1000}
            required
            placeholder="哪些内容需要再处理？"
          />
          <small>Garden Keeper 身份由服务器提供。</small>
          <button type="submit" disabled={returnPending}>
            {returnPending ? "退回中…" : "退回草稿"}
          </button>
          <ActionNotice state={returnState} />
        </form>

        <form className="admin-review-publish-form" action={publishAction}>
          <RevisionFields revision={revision} />
          <details>
            <summary>确认发布</summary>
            <p>
              发布会以原子方式更新公开投影，并记录版本快照。
            </p>
            <label>
              <input
                type="checkbox"
                name="publishConfirmation"
                value="confirmed"
                required
              />
              <span>我已检查清单，并确认发布此修订。</span>
            </label>
            <button
              className="admin-primary-action"
              type="submit"
              disabled={publishPending || !ready}
            >
              {publishPending ? "发布中…" : "发布"}
            </button>
          </details>
          <ActionNotice state={publishState} />
        </form>
      </div>
    </section>
  );
}
