export default function AdminLifecycleLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>Lifecycle maintenance</h1>
        <span>Gathering the paths that are open and resting…</span>
      </header>
      <div className="admin-lifecycle-loading" aria-label="Loading lifecycle records">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
