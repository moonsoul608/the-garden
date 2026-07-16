export default function AdminContentLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Keeper workbench</p>
        <h1>Content</h1>
        <span>Gathering the records on the workbench…</span>
      </header>
      <div className="admin-content-loading" role="status">
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-visually-hidden">Loading content</span>
      </div>
    </main>
  );
}
