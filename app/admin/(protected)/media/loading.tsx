export default function AdminMediaLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Garden Keeper · 媒体库</p>
        <h1>媒体库</h1>
        <span>正在检查封面对象和引用。</span>
      </header>
      <div className="admin-loading-line" aria-hidden="true" />
      <p className="admin-loading-copy" role="status">正在读取封面记录…</p>
    </main>
  );
}
