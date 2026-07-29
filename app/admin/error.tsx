"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="admin-error-title">
        <p className="admin-status-code">工作区暂不可用</p>
        <h1 id="admin-error-title">Garden Keeper 工作区暂时无法打开</h1>
        <p>
          受保护的工作区无法打开。内部错误详情未显示。
        </p>
        <div className="admin-access-actions">
          <button
            className="admin-primary-action"
            type="button"
            onClick={reset}
          >
            重试
          </button>
          <Link href="/">返回 The Garden</Link>
        </div>
      </section>
    </main>
  );
}
