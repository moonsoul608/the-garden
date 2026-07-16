import {
  LifecycleManagementUnavailableError,
  listLifecycleOverview,
  type LifecycleListItem,
  type LifecycleOverview,
} from "@/lib/content/admin";

import { LifecycleActions } from "./lifecycle-actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function LifecycleSection({
  id,
  title,
  description,
  emptyMessage,
  items,
}: Readonly<{
  id: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: readonly LifecycleListItem[];
}>) {
  return (
    <section className="admin-lifecycle-section" aria-labelledby={id}>
      <div className="admin-section-heading admin-section-heading--compact">
        <div>
          <p className="admin-section-kicker">Garden maintenance</p>
          <h2 id={id}>{title}</h2>
          <span>{description}</span>
        </div>
        <p className="admin-content-count">
          {items.length} {items.length === 1 ? "path" : "paths"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="admin-lifecycle-empty">
          <span aria-hidden="true">·</span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="admin-lifecycle-records" role="list">
          {items.map((item) => (
            <article
              className="admin-lifecycle-row"
              key={item.canonicalRoute ?? `${item.region}:${item.title}:${item.updatedAt}`}
              role="listitem"
            >
              <div className="admin-lifecycle-row-title">
                <span>{item.region}</span>
                <h3>{item.title}</h3>
                {item.canonicalRoute ? <code>{item.canonicalRoute}</code> : null}
              </div>
              <dl className="admin-lifecycle-row-meta">
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
                  <dt>Updated</dt>
                  <dd>
                    <time dateTime={item.updatedAt}>
                      {dateFormatter.format(new Date(item.updatedAt))}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Last action</dt>
                  <dd>
                    <strong>{item.lastAction}</strong>
                    <time dateTime={item.lastActionAt}>
                      {dateFormatter.format(new Date(item.lastActionAt))}
                    </time>
                  </dd>
                </div>
              </dl>
              <LifecycleActions item={item} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UnavailableState() {
  return (
    <section className="admin-lifecycle-unavailable" role="alert">
      <span aria-hidden="true">·</span>
      <h2>The maintenance paths are quiet for now.</h2>
      <p>
        Lifecycle records could not be loaded safely. No internal details were
        revealed and no action was run.
      </p>
    </section>
  );
}

export default async function AdminLifecyclePage() {
  let overview: LifecycleOverview | null = null;

  try {
    overview = await listLifecycleOverview();
  } catch (error) {
    if (!(error instanceof LifecycleManagementUnavailableError)) throw error;
  }

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>Lifecycle maintenance</h1>
        <span>
          A careful place for tending paths that are open, resting, or ready
          to return to Draft.
        </span>
      </header>

      <div className="admin-lifecycle-workspace">
        {overview ? (
          <>
            <LifecycleSection
              id="published-lifecycle-title"
              title="Published paths"
              description="Content currently open in the public garden."
              emptyMessage="No Published paths need maintenance."
              items={overview.published}
            />
            <LifecycleSection
              id="archived-lifecycle-title"
              title="Archived paths"
              description="Content resting outside discovery, with protected history."
              emptyMessage="No paths are resting in the archive."
              items={overview.archived}
            />
          </>
        ) : (
          <UnavailableState />
        )}

        <section
          className="admin-deleted-history"
          aria-labelledby="deleted-history-title"
        >
          <div>
            <p className="admin-section-kicker">Terminal history</p>
            <h2 id="deleted-history-title">Deleted route history</h2>
          </div>
          <p>
            Terminal route records are kept as a safety boundary. Deleted
            content details are intentionally not shown here.
          </p>
          <span>History view placeholder</span>
        </section>
      </div>
    </main>
  );
}
