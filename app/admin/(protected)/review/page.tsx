import Link from "next/link";

import { listReviewQueue } from "@/lib/content/admin";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminReviewQueuePage() {
  let queue;

  try {
    queue = await listReviewQueue();
  } catch {
    return (
      <main id="admin-main" className="admin-main">
        <header className="admin-page-header">
          <p>Review bench</p>
          <h1>The Review queue is resting.</h1>
          <span>
            The workspace is temporarily unavailable. No internal details were
            revealed and no content was changed.
          </span>
        </header>
        <div className="admin-review-unavailable" role="status">
          <p>Try opening the queue again in a moment.</p>
          <Link href="/admin/review">Refresh the Review queue</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="admin-main" className="admin-main admin-review-main">
      <header className="admin-page-header admin-page-header--with-action">
        <div>
          <p>Review bench</p>
          <h1>Work waiting for a careful look</h1>
          <span>
            Check readiness, return work for another pass, or open the path to
            the garden.
          </span>
        </div>
        <p className="admin-review-count">
          <strong>{queue.length}</strong>
          <span>{queue.length === 1 ? "Review" : "Reviews"}</span>
        </p>
      </header>

      <section className="admin-review-queue" aria-labelledby="review-queue-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">Submitted work</p>
            <h2 id="review-queue-title">On the bench</h2>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="admin-content-empty">
            <span aria-hidden="true">·</span>
            <h3>The Review bench is clear.</h3>
            <p>Drafts will gather here after they pass readiness checks.</p>
            <Link href="/admin/content">Return to the content workbench</Link>
          </div>
        ) : (
          <div className="admin-review-list" role="list">
            {queue.map((item) => (
              <article className="admin-review-row" key={item.revisionId} role="listitem">
                <div className="admin-review-row-title">
                  <span>{item.region}</span>
                  <h3>{item.title}</h3>
                </div>
                <dl>
                  <div>
                    <dt>Growth</dt>
                    <dd>{item.growthStage}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      <time dateTime={item.submittedAt}>
                        {dateFormatter.format(new Date(item.submittedAt))}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Readiness</dt>
                    <dd>
                      <span
                        className={`admin-readiness-dot admin-readiness-dot--${item.ready ? "ready" : "attention"}`}
                        aria-hidden="true"
                      />
                      {item.ready
                        ? "Ready"
                        : `${item.attentionCount} to revisit`}
                    </dd>
                  </div>
                </dl>
                <Link href={`/admin/review/${item.revisionId}`}>
                  Inspect <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
