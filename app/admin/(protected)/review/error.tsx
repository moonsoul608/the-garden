"use client";

export default function AdminReviewError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Review bench</p>
        <h1>The Review workspace could not be opened.</h1>
        <span>
          No internal details were revealed and no lifecycle operation was run.
        </span>
      </header>
      <div className="admin-review-unavailable" role="alert">
        <button className="admin-primary-action" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
