"use client";

import Link from "next/link";

export default function AdminContentError({ reset }: { reset: () => void }) {
  return (
    <main id="admin-main" className="admin-main">
      <section className="admin-access-card" aria-labelledby="content-error-title">
        <p className="admin-status-code">Workbench unavailable</p>
        <h1 id="content-error-title">The content records could not be gathered</h1>
        <p>No internal details were revealed. The current page can be tried again safely.</p>
        <div className="admin-access-actions">
          <button className="admin-primary-action" type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/admin">Return to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
