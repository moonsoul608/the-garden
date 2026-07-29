import {
  LifecycleManagementUnavailableError,
  listLifecycleOverview,
  type LifecycleListItem,
  type LifecycleOverview,
} from "@/lib/content/admin";

import { lifecycleLabel } from "../admin-labels";
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
          <p className="admin-section-kicker">内容维护</p>
          <h2 id={id}>{title}</h2>
          <span>{description}</span>
        </div>
        <p className="admin-content-count">
          {items.length} 条
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
                  <dt>生命周期</dt>
                  <dd>
                    <span
                      className={`admin-lifecycle-marker admin-lifecycle-marker--${item.lifecycle.toLocaleLowerCase()}`}
                      aria-hidden="true"
                    />
                    {lifecycleLabel(item.lifecycle)}
                  </dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>
                    <time dateTime={item.updatedAt}>
                      {dateFormatter.format(new Date(item.updatedAt))}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>上次操作</dt>
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
      <h2>维护列表暂不可用。</h2>
      <p>
        生命周期记录无法安全加载。内部详情未显示，也没有执行任何操作。
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
        <h1>生命周期管理</h1>
        <span>
          管理已发布、已归档，以及可恢复为草稿的内容。
        </span>
      </header>

      <div className="admin-lifecycle-workspace">
        {overview ? (
          <>
            <LifecycleSection
              id="published-lifecycle-title"
              title="已发布内容"
              description="当前在公开站点可访问的内容。"
              emptyMessage="没有需要维护的已发布内容。"
              items={overview.published}
            />
            <LifecycleSection
              id="archived-lifecycle-title"
              title="已归档内容"
              description="已移出发现入口并保留受保护历史的内容。"
              emptyMessage="当前没有已归档内容。"
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
            <p className="admin-section-kicker">终止记录</p>
            <h2 id="deleted-history-title">已删除路由历史</h2>
          </div>
          <p>
            终止路由记录会作为安全边界保留。已删除内容详情不会在这里显示。
          </p>
          <span>历史视图占位</span>
        </section>
      </div>
    </main>
  );
}
