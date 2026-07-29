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

import { lifecycleLabel } from "../admin-labels";
import { INITIAL_LIFECYCLE_ACTION_STATE } from "./action-contracts";
import {
  archiveContentAction,
  deleteContentAction,
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
      <strong>{state.status === "success" ? "操作完成" : "无法继续"}</strong>
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
    if (actionState.status === "success") {
      router.push(actionState.destination ?? "/admin/content");
    }
  }, [actionState.destination, actionState.status, router]);

  return (
    <>
      <button type="button" onClick={() => openDialog(dialogRef)}>
        归档
      </button>
      <dialog
        className="admin-lifecycle-dialog"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">归档确认</p>
          <h2 id={dialogTitleId}>确认归档此内容？</h2>
          <Identity item={item} />
          <div className="admin-lifecycle-impact">
            <h3>归档会产生的变化</h3>
            <ul>
              <li>内容会从区域集合、搜索和首页精选中移除。</li>
              <li>公开路由会进入归档状态。</li>
              <li>不可变归档检查点会保留当前状态。</li>
            </ul>
          </div>
          <p className="admin-lifecycle-dialog-note">
            现有归档服务会在更改前重新检查生命周期资格和并发状态。
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
                保持已发布
              </button>
              <button
                type="submit"
                className="admin-primary-action"
                disabled={pending}
              >
                {pending ? "归档中…" : "确认归档"}
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
    if (actionState.status === "success" && actionState.destination) {
      router.push(actionState.destination);
    }
  }, [actionState.destination, actionState.status, router]);

  return (
    <>
      <button type="button" onClick={() => openDialog(dialogRef)}>
        恢复为草稿
      </button>
      <dialog
        className="admin-lifecycle-dialog"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">恢复预览</p>
          <h2 id={dialogTitleId}>将此归档恢复到工作区？</h2>
          <Identity item={item} />
          <dl className="admin-lifecycle-preview-grid">
            <div>
              <dt>来源归档</dt>
              <dd>
                {item.sourceArchiveAt ? (
                  <time dateTime={item.sourceArchiveAt}>
                    受保护于 {dateFormatter.format(new Date(item.sourceArchiveAt))}
                  </time>
                ) : (
                  "归档检查点不可用"
                )}
              </dd>
            </div>
            <div>
              <dt>结果</dt>
              <dd>创建一个可编辑并可提交审核的私有草稿</dd>
            </div>
          </dl>
          <div className="admin-lifecycle-impact">
            <h3>仍会保留的保护</h3>
            <ul>
              <li>所选归档会保留为草稿的来源凭据。</li>
              <li>已归档投影会继续保持归档，直到后续审核发布。</li>
              <li>归档时间戳会通过乐观锁重新检查。</li>
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
                保持已归档
              </button>
              <button
                type="submit"
                className="admin-primary-action"
                disabled={pending || !item.sourceArchiveAt}
              >
                {pending ? "恢复中…" : "创建私有草稿"}
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
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteContentAction,
    INITIAL_LIFECYCLE_ACTION_STATE,
  );

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
        永久删除
      </button>
      <dialog
        className="admin-lifecycle-dialog admin-lifecycle-dialog--danger"
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
      >
        <div className="admin-lifecycle-dialog-body">
          <p className="admin-section-kicker">危险操作</p>
          <h2 id={dialogTitleId}>永久删除此内容记录？</h2>
          <Identity item={item} />

          <div className="admin-deletion-preview" aria-live="polite">
            <section>
              <h3>受影响路由</h3>
              <p>
                当前公开路由会变为终止状态，相关历史路由会由服务器一并处理。
              </p>
            </section>
            <section>
              <h3>关系影响</h3>
              <p>服务器会在删除时移除此内容的实时关系。</p>
            </section>
            <section>
              <h3>版本保留</h3>
              <p>历史版本会继续受保护，不会被删除。</p>
            </section>
            <section>
              <h3>存储行为</h3>
              <p>Storage 对象不会立即删除。</p>
            </section>
          </div>
          <div className="admin-lifecycle-warning" role="alert">
            <strong>不可逆的实时记录删除</strong>
            <span>
              路由会变为终止状态，实时投影无法恢复。历史版本仍会保留保护。
            </span>
          </div>
          <form className="admin-delete-confirmation" action={deleteAction}>
            <input
              type="hidden"
              name="canonicalRoute"
              value={item.canonicalRoute ?? ""}
            />
            <label htmlFor={confirmationId}>
              输入 <strong>DELETE</strong> 确认
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
                保留此归档
              </button>
              <button
                type="submit"
                className="admin-destructive-confirmation"
                disabled={deletePending}
              >
                {deletePending ? "删除记录中…" : "永久删除"}
              </button>
            </div>
          </form>
          <ActionNotice state={deleteState} />
        </div>
      </dialog>
    </>
  );
}

export function LifecycleActions({
  item,
}: Readonly<{ item: LifecycleListItem }>) {
  if (!item.canonicalRoute) {
    return <span className="admin-lifecycle-action-note">公开路由不可用</span>;
  }

  if (item.workspaceState) {
    return (
      <span className="admin-lifecycle-action-note">
        {lifecycleLabel(item.workspaceState)}工作正在进行
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
