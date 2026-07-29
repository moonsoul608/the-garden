import Link from "next/link";

import {
  DASHBOARD_LIFECYCLES,
  getDashboardSummary,
  type DashboardLifecycle,
} from "@/lib/content/admin";

import { lifecycleLabel } from "./admin-labels";

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
    label: "创建内容",
    description: "在 Garden Keeper 工作区创建新的草稿。",
    marker: "01",
    href: "/admin/content/new",
  },
  {
    label: "审核队列",
    description: "查看等待审核的内容。",
    marker: "02",
    href: "/admin/review",
  },
  {
    label: "媒体库",
    description: "管理封面图片及其详情。",
    marker: "03",
    href: "/admin/media",
  },
  {
    label: "生命周期管理",
    description: "管理已发布和已归档内容。",
    marker: "04",
    href: "/admin/lifecycle",
  },
];

const lifecycleDescriptions: Record<DashboardLifecycle, string> = {
  Draft: "仍在编辑",
  Review: "等待审核",
  Published: "已对外发布",
  Archived: "已移出发现入口",
};

export default async function AdminDashboardPage() {
  const summary = await getDashboardSummary();
  const hasContent = summary.totalContent > 0;

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>工作台</h1>
        <span>查看当前内容的编辑、审核、发布与归档状态。</span>
      </header>

      <div className="admin-dashboard">
        <section className="admin-overview" aria-labelledby="overview-title">
          <div className="admin-section-heading">
            <div>
              <p className="admin-section-kicker">概览</p>
              <h2 id="overview-title">内容状态概览</h2>
            </div>
            <p className="admin-total">
              <strong>{summary.totalContent}</strong>
              <span>
                条内容
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
                      <strong>{lifecycleLabel(lifecycle)}</strong>
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
              <h3>还没有内容。</h3>
              <p>内容进入工作区后，这里会显示生命周期统计。</p>
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
                <p className="admin-section-kicker">近期活动</p>
                <h2 id="activity-title">操作记录</h2>
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
                <p>还没有记录任何活动。</p>
                <span>
                  后续阶段会在这里汇总编辑、发布和归档记录。
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
                <p className="admin-section-kicker">快捷操作</p>
                <h2 id="quick-actions-title">常用入口</h2>
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
                      <span className="admin-action-ready">打开</span>
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
                      <span className="admin-coming-soon">稍后提供</span>
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
