import Link from "next/link";

import {
  getAdminGrowthPresentation,
  listAdminContent,
} from "@/lib/content/admin";

import { lifecycleLabel } from "../admin-labels";
import { startDraftRevisionAction } from "./actions";

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
          <p>Garden Keeper 工作区</p>
          <h1>内容管理</h1>
          <span>集中管理草稿、审核内容和已发布记录。</span>
        </div>
        <Link className="admin-primary-action" href="/admin/content/new">
          创建内容
        </Link>
      </header>

      <section className="admin-content-workbench" aria-labelledby="content-list-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">全部内容</p>
            <h2 id="content-list-title">内容列表</h2>
          </div>
          <p className="admin-content-count">
            {content.length} 条
          </p>
        </div>

        {content.length === 0 ? (
          <div className="admin-content-empty">
            <span aria-hidden="true">·</span>
            <h3>当前没有内容。</h3>
            <p>准备好内容后，可以先创建草稿。</p>
            <Link href="/admin/content/new">创建内容</Link>
          </div>
        ) : (
          <div className="admin-content-list" role="list">
            {content.map((item) => {
              const growth = getAdminGrowthPresentation(item.growthStage);

              return (
                <article className="admin-content-row" key={item.contentId} role="listitem">
                  <div className="admin-content-title">
                    <span>{item.region}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <dl className="admin-content-meta">
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
                      <dt>Growth Stage</dt>
                      <dd>
                        {growth.marker ? (
                          <span aria-hidden="true">{growth.marker}</span>
                        ) : null}
                        {growth.label}
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
                  </dl>
                  <div className="admin-content-row-action">
                    {item.revisionLifecycle === "Draft" && item.revisionId ? (
                      <Link href={`/admin/content/${item.revisionId}`}>
                        编辑草稿 <span aria-hidden="true">→</span>
                      </Link>
                    ) : item.revisionLifecycle === "Review" && item.revisionId ? (
                      <Link href={`/admin/review/${item.revisionId}`}>
                        查看审核 <span aria-hidden="true">→</span>
                      </Link>
                    ) : item.projectionLifecycle === "Published" &&
                      item.revisionLifecycle === null &&
                      item.revisionId === null ? (
                      <form action={startDraftRevisionAction}>
                        <input
                          type="hidden"
                          name="contentId"
                          value={item.contentId}
                        />
                        <button type="submit">
                          创建草稿 <span aria-hidden="true">→</span>
                        </button>
                      </form>
                    ) : (
                      <span>没有打开的草稿</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
