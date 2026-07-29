import Link from "next/link";
import { notFound } from "next/navigation";

import { getReviewWorkspaceDetail } from "@/lib/content/admin";

import {
  contentLanguageLabels,
  detailLevelLabels,
  lifecycleLabel,
} from "../../admin-labels";
import { ReviewActionPanel } from "../review-action-panel";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminReviewDetailPage({
  params,
}: Readonly<{ params: Promise<{ revisionId: string }> }>) {
  const { revisionId } = await params;
  const detail = await getReviewWorkspaceDetail(revisionId);

  if (!detail) notFound();

  const { revision, report, checklist } = detail;

  return (
    <main id="admin-main" className="admin-main admin-review-detail-main">
      <Link className="admin-back-link" href="/admin/review">
        <span aria-hidden="true">←</span> 审核队列
      </Link>

      <header className="admin-review-detail-header">
        <div>
          <p className="admin-section-kicker">
            {revision.lifecycle === "Draft" ? "准备情况预览" : "审核详情"}
          </p>
          <h1>{detail.title}</h1>
          <span>
            {revision.lifecycle === "Draft"
              ? "草稿提交审核前的最后准备情况检查。"
              : "已提交内容正在等待审核。"}
          </span>
        </div>
        <div
          className={`admin-readiness-card admin-readiness-card--${report.ready ? "ready" : "attention"}`}
        >
          <span>{report.ready ? "就绪" : "需要处理"}</span>
          <strong>
            {report.ready
              ? "所有检查项均已通过。"
              : `${report.validationIssues.length} 个检查项需要处理。`}
          </strong>
        </div>
      </header>

      <div className="admin-review-detail-grid">
        <section className="admin-review-metadata" aria-labelledby="metadata-title">
          <div className="admin-section-heading admin-section-heading--compact">
            <div>
              <p className="admin-section-kicker">内容元数据</p>
              <h2 id="metadata-title">当前内容</h2>
            </div>
          </div>
          <dl>
            <div><dt>区域</dt><dd>{revision.region}</dd></div>
            <div><dt>内容类型</dt><dd>{revision.contentType}</dd></div>
            <div><dt>Growth Stage</dt><dd>{revision.growthStage ?? "不跟踪 Growth Stage"}</dd></div>
            <div><dt>详细程度</dt><dd>{detailLevelLabels[revision.detailLevel]}</dd></div>
            <div><dt>语言</dt><dd>{contentLanguageLabels[revision.contentLanguage]}</dd></div>
            <div><dt>Slug</dt><dd>{revision.slug ?? "未设置"}</dd></div>
          </dl>
        </section>

        <section className="admin-review-revision" aria-labelledby="revision-title">
          <div className="admin-section-heading admin-section-heading--compact">
            <div>
              <p className="admin-section-kicker">当前修订</p>
              <h2 id="revision-title">修订信息</h2>
            </div>
          </div>
          <dl>
            <div><dt>生命周期</dt><dd>{lifecycleLabel(revision.lifecycle)}</dd></div>
            <div><dt>变更</dt><dd>{revision.lockVersion}</dd></div>
            <div>
              <dt>来源</dt>
              <dd>{revision.sourceVersionId ? "已发布版本" : "新内容"}</dd>
            </div>
            <div>
              <dt>{revision.reviewSubmittedAt ? "提交时间" : "上次保存"}</dt>
              <dd>
                <time dateTime={revision.reviewSubmittedAt ?? revision.updatedAt}>
                  {dateFormatter.format(
                    new Date(revision.reviewSubmittedAt ?? revision.updatedAt),
                  )}
                </time>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-review-checklist" aria-labelledby="checklist-title">
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">准备情况报告</p>
            <h2 id="checklist-title">发布前检查</h2>
          </div>
          <p>由现有内容准备情况服务生成。</p>
        </div>
        <div className="admin-review-checklist-grid">
          {checklist.map((item) => (
            <article key={item.key} className="admin-review-check">
              <div>
                <span
                  className={`admin-readiness-dot admin-readiness-dot--${item.state}`}
                  aria-hidden="true"
                />
                <h3>{item.label}</h3>
                <strong>
                  {item.state === "attention"
                    ? "需要处理"
                    : item.state === "information"
                      ? "参考信息"
                      : "通过"}
                </strong>
              </div>
              <p>{item.summary}</p>
              {item.details.length > 0 ? (
                <ul>
                  {item.details.map((entry) => <li key={entry}>{entry}</li>)}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <ReviewActionPanel revision={revision} ready={report.ready} />
    </main>
  );
}
