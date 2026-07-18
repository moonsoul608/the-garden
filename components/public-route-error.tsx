"use client";

import Link from "next/link";

export default function PublicRouteError() {
  return (
    <main id="main-content" tabIndex={-1} className="not-found">
      <section className="not-found-card card" aria-labelledby="route-error-title">
        <h1 id="route-error-title">This path is still being prepared.</h1>
        <nav
          className="not-found-actions"
          aria-label="Continue from the unavailable path"
        >
          <Link className="button button-primary" href="/">
            Back to the entrance
          </Link>
          <Link className="button button-secondary" href="/garden-index">
            Open Garden Index
          </Link>
        </nav>
      </section>
    </main>
  );
}
