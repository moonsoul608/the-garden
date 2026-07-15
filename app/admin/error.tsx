"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="admin-error-title">
        <p className="admin-status-code">Access check unavailable</p>
        <h1 id="admin-error-title">Admin access is temporarily unavailable</h1>
        <p>Your access could not be checked. No admin content was opened.</p>
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
