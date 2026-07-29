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
          <p>审核队列</p>
          <h1>审核队列暂不可用。</h1>
          <span>
            工作区暂时不可用。内部详情未显示，内容未被更改。
          </span>
        </header>
        <div className="admin-review-unavailable" role="status">
          <p>请稍后重新打开审核队列。</p>
          <Link href="/admin/review">刷新审核队列</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="admin-main" className="admin-main admin-review-main">
      <header className="admin-page-header admin-page-header--with-action">
        <div>
          <p>审核队列</p>
          <h1>等待审核的内容</h1>
          <span>
            检查准备情况、退回草稿，或发布内容。
          </span>
        </div>
        <p className="admin-review-count">
          <strong>{queue.length}</strong>
          <span>待审核</span>
        </p>
      </header>

      <section className="admin-review-queue" aria-labelledby="review-queue-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">已提交内容</p>
            <h2 id="review-queue-title">审核列表</h2>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="admin-content-empty">
            <span aria-hidden="true">·</span>
            <h3>当前没有待审核内容。</h3>
            <p>草稿通过准备情况检查后会显示在这里。</p>
            <Link href="/admin/content">返回内容管理</Link>
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
                    <dt>Growth Stage</dt>
                    <dd>{item.growthStage ?? "不跟踪 Growth Stage"}</dd>
                  </div>
                  <div>
                    <dt>提交时间</dt>
                    <dd>
                      <time dateTime={item.submittedAt}>
                        {dateFormatter.format(new Date(item.submittedAt))}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>准备情况</dt>
                    <dd>
                      <span
                        className={`admin-readiness-dot admin-readiness-dot--${item.ready ? "ready" : "attention"}`}
                        aria-hidden="true"
                      />
                      {item.ready
                        ? "就绪"
                        : `${item.attentionCount} 项需要处理`}
                    </dd>
                  </div>
                </dl>
                <Link href={`/admin/review/${item.revisionId}`}>
                  查看 <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
