import Link from "next/link";
import { notFound } from "next/navigation";

import { getReviewWorkspaceDetail } from "@/lib/content/admin";

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
        <span aria-hidden="true">←</span> Review queue
      </Link>

      <header className="admin-review-detail-header">
        <div>
          <p className="admin-section-kicker">
            {revision.lifecycle === "Draft" ? "Readiness preview" : "Review detail"}
          </p>
          <h1>{detail.title}</h1>
          <span>
            {revision.lifecycle === "Draft"
              ? "A final readiness pass before this Draft enters Review."
              : "Submitted work held still for a careful editorial look."}
          </span>
        </div>
        <div
          className={`admin-readiness-card admin-readiness-card--${report.ready ? "ready" : "attention"}`}
        >
          <span>{report.ready ? "Ready" : "Needs tending"}</span>
          <strong>
            {report.ready
              ? "All reported checks are clear."
              : `${report.validationIssues.length} checklist item${report.validationIssues.length === 1 ? "" : "s"} need attention.`}
          </strong>
        </div>
      </header>

      <div className="admin-review-detail-grid">
        <section className="admin-review-metadata" aria-labelledby="metadata-title">
          <div className="admin-section-heading admin-section-heading--compact">
            <div>
              <p className="admin-section-kicker">Content metadata</p>
              <h2 id="metadata-title">What is on the bench</h2>
            </div>
          </div>
          <dl>
            <div><dt>Region</dt><dd>{revision.region}</dd></div>
            <div><dt>Content type</dt><dd>{revision.contentType}</dd></div>
            <div><dt>Growth stage</dt><dd>{revision.growthStage ?? "Not growth-tracked"}</dd></div>
            <div><dt>Detail level</dt><dd>{revision.detailLevel}</dd></div>
            <div><dt>Language</dt><dd>{revision.contentLanguage}</dd></div>
            <div><dt>Slug</dt><dd>{revision.slug ?? "Not set"}</dd></div>
          </dl>
        </section>

        <section className="admin-review-revision" aria-labelledby="revision-title">
          <div className="admin-section-heading admin-section-heading--compact">
            <div>
              <p className="admin-section-kicker">Current revision</p>
              <h2 id="revision-title">Revision awareness</h2>
            </div>
          </div>
          <dl>
            <div><dt>Lifecycle</dt><dd>{revision.lifecycle}</dd></div>
            <div><dt>Change</dt><dd>{revision.lockVersion}</dd></div>
            <div>
              <dt>Source</dt>
              <dd>{revision.sourceVersionId ? "Published version" : "New content"}</dd>
            </div>
            <div>
              <dt>{revision.reviewSubmittedAt ? "Submitted" : "Last saved"}</dt>
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
            <p className="admin-section-kicker">Readiness report</p>
            <h2 id="checklist-title">Before the path opens</h2>
          </div>
          <p>Reported by the existing content readiness service.</p>
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
                    ? "Attention"
                    : item.state === "information"
                      ? "For context"
                      : "Clear"}
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
