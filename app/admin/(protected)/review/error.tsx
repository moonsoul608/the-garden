"use client";

export default function AdminReviewError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>审核队列</p>
        <h1>审核工作区无法打开。</h1>
        <span>
          内部详情未显示，也没有执行任何生命周期操作。
        </span>
      </header>
      <div className="admin-review-unavailable" role="alert">
        <button className="admin-primary-action" type="button" onClick={reset}>
          重试
        </button>
      </div>
    </main>
  );
}
