export default function AdminReviewLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>审核队列</p>
        <h1>正在加载已提交内容…</h1>
        <span>正在加载审核队列和准备情况报告。</span>
      </header>
      <div className="admin-content-loading" aria-label="正在加载审核">
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
      </div>
    </main>
  );
}
