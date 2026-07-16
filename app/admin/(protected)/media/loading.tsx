export default function AdminMediaLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Garden Keeper · Media</p>
        <h1>Seed library</h1>
        <span>Checking the cover shelves and their references.</span>
      </header>
      <div className="admin-loading-line" aria-hidden="true" />
      <p className="admin-loading-copy" role="status">Reading cover records…</p>
    </main>
  );
}
