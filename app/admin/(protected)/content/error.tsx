"use client";

import Link from "next/link";

export default function AdminContentError({ reset }: { reset: () => void }) {
  return (
    <main id="admin-main" className="admin-main">
      <section className="admin-access-card" aria-labelledby="content-error-title">
        <p className="admin-status-code">工作区不可用</p>
        <h1 id="content-error-title">无法加载内容记录</h1>
        <p>内部详情未显示。可以安全地重试当前页面。</p>
        <div className="admin-access-actions">
          <button className="admin-primary-action" type="button" onClick={reset}>
            重试
          </button>
          <Link href="/admin">返回工作台</Link>
        </div>
      </section>
    </main>
  );
}
