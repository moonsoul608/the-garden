export default function AdminReviewLoading() {
  return (
    <main id="admin-main" className="admin-main" aria-busy="true">
      <header className="admin-page-header">
        <p>Review bench</p>
        <h1>Gathering submitted work…</h1>
        <span>Loading the Review queue and readiness reports.</span>
      </header>
      <div className="admin-content-loading" aria-label="Loading Reviews">
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
        <span className="admin-loading-line" />
      </div>
    </main>
  );
}
