import Link from "next/link";

import {
  DASHBOARD_LIFECYCLES,
  getDashboardSummary,
  type DashboardLifecycle,
} from "@/lib/content/admin";

type RecentActivityItem = Readonly<{
  id: string;
  kind: "edit" | "publication" | "archive";
  label: string;
  occurredAt: string;
}>;

type QuickAction = Readonly<{
  label: string;
  description: string;
  marker: string;
  href?: string;
}>;

const recentActivity: readonly RecentActivityItem[] = [];

const quickActions: readonly QuickAction[] = [
  {
    label: "Create Content",
    description: "Plant a new Draft in the Keeper workspace.",
    marker: "01",
    href: "/admin/content/new",
  },
  {
    label: "Review Queue",
    description: "See work waiting for an editorial check.",
    marker: "02",
    href: "/admin/review",
  },
  {
    label: "Media",
    description: "Tend cover images and their details.",
    marker: "03",
    href: "/admin/media",
  },
  {
    label: "Lifecycle",
    description: "Tend Published and Archived garden paths.",
    marker: "04",
    href: "/admin/lifecycle",
  },
];

const lifecycleDescriptions: Record<DashboardLifecycle, string> = {
  Draft: "Still being planted",
  Review: "Waiting for a careful look",
  Published: "Open in the garden",
  Archived: "Resting out of discovery",
};

export default async function AdminDashboardPage() {
  const summary = await getDashboardSummary();
  const hasContent = summary.totalContent > 0;

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>Keeper dashboard</h1>
        <span>A quiet view of what is growing, waiting, and resting.</span>
      </header>

      <div className="admin-dashboard">
        <section className="admin-overview" aria-labelledby="overview-title">
          <div className="admin-section-heading">
            <div>
              <p className="admin-section-kicker">Overview</p>
              <h2 id="overview-title">The garden at a glance</h2>
            </div>
            <p className="admin-total">
              <strong>{summary.totalContent}</strong>
              <span>
                {summary.totalContent === 1 ? "content item" : "content items"}
              </span>
            </p>
          </div>

          {hasContent ? (
            <dl className="admin-lifecycle-list">
              {DASHBOARD_LIFECYCLES.map((lifecycle) => (
                <div key={lifecycle} className="admin-lifecycle-item">
                  <dt>
                    <span
                      className={`admin-lifecycle-marker admin-lifecycle-marker--${lifecycle.toLocaleLowerCase()}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{lifecycle}</strong>
                      <small>{lifecycleDescriptions[lifecycle]}</small>
                    </span>
                  </dt>
                  <dd>{summary.lifecycleCounts[lifecycle]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="admin-empty-state">
              <p className="admin-empty-symbol" aria-hidden="true">
                ·
              </p>
              <h3>Nothing has been planted here yet.</h3>
              <p>Lifecycle counts will appear when content enters the workspace.</p>
            </div>
          )}
        </section>

        <div className="admin-dashboard-lower">
          <section
            className="admin-dashboard-section admin-activity"
            aria-labelledby="activity-title"
          >
            <div className="admin-section-heading admin-section-heading--compact">
              <div>
                <p className="admin-section-kicker">Recent Activity</p>
                <h2 id="activity-title">Tending notes</h2>
              </div>
            </div>

            {recentActivity.length > 0 ? (
              <ol className="admin-activity-list">
                {recentActivity.map((activity) => (
                  <li key={activity.id}>
                    <span>{activity.kind}</span>
                    <strong>{activity.label}</strong>
                    <time dateTime={activity.occurredAt}>
                      {activity.occurredAt}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="admin-inline-empty">
                <p>No activity has been recorded.</p>
                <span>
                  Recent edits, publications, and archive events will gather here
                  in a later phase.
                </span>
              </div>
            )}
          </section>

          <nav
            className="admin-dashboard-section admin-quick-actions"
            aria-labelledby="quick-actions-title"
          >
            <div className="admin-section-heading admin-section-heading--compact">
              <div>
                <p className="admin-section-kicker">Quick Actions</p>
                <h2 id="quick-actions-title">Paths to prepare</h2>
              </div>
            </div>

            <ul className="admin-action-list">
              {quickActions.map((action) => (
                <li key={action.label}>
                  {action.href ? (
                    <Link
                      className="admin-action-placeholder admin-action-link"
                      href={action.href}
                    >
                      <span className="admin-action-marker" aria-hidden="true">
                        {action.marker}
                      </span>
                      <span className="admin-action-copy">
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                      </span>
                      <span className="admin-action-ready">Open</span>
                    </Link>
                  ) : (
                    <div className="admin-action-placeholder" aria-disabled="true">
                      <span className="admin-action-marker" aria-hidden="true">
                        {action.marker}
                      </span>
                      <span className="admin-action-copy">
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                      </span>
                      <span className="admin-coming-soon">Coming later</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </main>
  );
}
