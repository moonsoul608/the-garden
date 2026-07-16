"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="admin-error-title">
        <p className="admin-status-code">Workspace unavailable</p>
        <h1 id="admin-error-title">The Keeper workspace is taking a pause</h1>
        <p>
          The protected workspace could not be opened. No internal details were
          revealed.
        </p>
        <div className="admin-access-actions">
          <button
            className="admin-primary-action"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
          <Link href="/">Return to The Garden</Link>
        </div>
      </section>
    </main>
  );
}
