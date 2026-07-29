export default function AdminContentLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Garden Keeper 工作区</p>
        <h1>内容管理</h1>
        <span>正在加载工作区内容记录…</span>
      </header>
      <div className="admin-content-loading" role="status">
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-visually-hidden">正在加载内容</span>
      </div>
    </main>
  );
}
