import Link from "next/link";

import { listAdminContent } from "@/lib/content/admin";
import type { GrowthStage } from "@/types";

const growthMarkers: Record<GrowthStage, string> = {
  Seed: "🌰",
  Sprout: "🌱",
  Growing: "🌿",
  Bloom: "🌸",
  Dormant: "🍂",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminContentPage() {
  const content = await listAdminContent();

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header admin-page-header--with-action">
        <div>
          <p>Keeper workbench</p>
          <h1>Content</h1>
          <span>Drafts and garden records gathered on one quiet bench.</span>
        </div>
        <Link className="admin-primary-action" href="/admin/content/new">
          Create Content
        </Link>
      </header>

      <section className="admin-content-workbench" aria-labelledby="content-list-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">All content</p>
            <h2 id="content-list-title">What is being tended</h2>
          </div>
          <p className="admin-content-count">
            {content.length} {content.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        {content.length === 0 ? (
          <div className="admin-content-empty">
            <span aria-hidden="true">·</span>
            <h3>The workbench is clear.</h3>
            <p>Create the first Draft when there is something ready to be planted.</p>
            <Link href="/admin/content/new">Create Content</Link>
          </div>
        ) : (
          <div className="admin-content-list" role="list">
            {content.map((item) => (
              <article className="admin-content-row" key={item.contentId} role="listitem">
                <div className="admin-content-title">
                  <span>{item.region}</span>
                  <h3>{item.title}</h3>
                </div>
                <dl className="admin-content-meta">
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>
                      <span
                        className={`admin-lifecycle-marker admin-lifecycle-marker--${item.lifecycle.toLocaleLowerCase()}`}
                        aria-hidden="true"
                      />
                      {item.lifecycle}
                    </dd>
                  </div>
                  <div>
                    <dt>Growth</dt>
                    <dd>
                      <span aria-hidden="true">{growthMarkers[item.growthStage]}</span>
                      {item.growthStage}
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      <time dateTime={item.updatedAt}>
                        {dateFormatter.format(new Date(item.updatedAt))}
                      </time>
                    </dd>
                  </div>
                </dl>
                <div className="admin-content-row-action">
                  {item.revisionLifecycle === "Draft" && item.revisionId ? (
                    <Link href={`/admin/content/${item.revisionId}`}>
                      Edit Draft <span aria-hidden="true">→</span>
                    </Link>
                  ) : item.revisionLifecycle === "Review" && item.revisionId ? (
                    <Link href={`/admin/review/${item.revisionId}`}>
                      Inspect Review <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <span>No Draft open</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
