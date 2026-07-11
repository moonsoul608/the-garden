import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Path not found",
  description: "This path could not be found in The Garden.",
};

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="not-found">
      <section className="not-found-card card" aria-labelledby="not-found-title">
        <p className="eyebrow">A path has faded</p>
        <h1 id="not-found-title">This path could not be found.</h1>
        <p className="tagline">The trail may have changed, but the garden is still here.</p>
        <p className="not-found-copy">Return to the entrance, or use the Garden Index to choose another path.</p>
        <nav className="not-found-actions" aria-label="Continue from the missing path">
          <Link className="button button-primary" href="/">Back to the entrance</Link>
          <Link className="button button-secondary" href="/garden-index">Open Garden Index</Link>
        </nav>
      </section>
    </main>
  );
}
