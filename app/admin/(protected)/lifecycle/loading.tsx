export default function AdminLifecycleLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>生命周期管理</h1>
        <span>正在加载已发布和已归档内容…</span>
      </header>
      <div className="admin-lifecycle-loading" aria-label="正在加载生命周期记录">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
