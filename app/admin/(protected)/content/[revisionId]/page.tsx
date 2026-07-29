import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createAdminContentService,
  getReviewWorkspaceDetail,
  listGrowthNotes,
} from "@/lib/content/admin";
import { requiresGrowthStage } from "@/lib/content/validation";

import { saveDraftAction } from "../actions";
import { ContentForm } from "../content-form";
import { GrowthNotesSection } from "../growth-notes-section";
import { ReviewActionPanel } from "../../review/review-action-panel";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EditAdminContentPage({
  params,
}: Readonly<{ params: Promise<{ revisionId: string }> }>) {
  const { revisionId } = await params;
  const draft = await createAdminContentService().getDraftById(revisionId);

  if (!draft) notFound();

  const reviewDetail =
    draft.lifecycle === "Draft"
      ? await getReviewWorkspaceDetail(revisionId)
      : null;

  if (draft.lifecycle === "Draft" && !reviewDetail) notFound();

  const growthNotesApplicable = requiresGrowthStage(
    draft.region,
    draft.contentType,
  );
  const growthNotes = growthNotesApplicable
    ? await listGrowthNotes(draft.contentId)
    : [];
  const title = draft.titleEn?.trim() || draft.titleZh?.trim() || "Untitled Draft";

  return (
    <main id="admin-main" className="admin-main admin-editor-main">
      <Link className="admin-back-link" href="/admin/content">
        <span aria-hidden="true">←</span> Content workbench
      </Link>
      <header className="admin-page-header admin-editor-header">
        <div>
          <p>Draft editor</p>
          <h1>{title}</h1>
          <span>Simple structured fields for careful tending.</span>
        </div>
        <dl className="admin-revision-card" aria-label="Current revision">
          <div>
            <dt>Current revision</dt>
            <dd>Change {draft.lockVersion}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{draft.sourceVersionId ? "Published version" : "New content"}</dd>
          </div>
          <div>
            <dt>Last saved</dt>
            <dd>
              <time dateTime={draft.updatedAt}>
                {dateFormatter.format(new Date(draft.updatedAt))}
              </time>
            </dd>
          </div>
        </dl>
      </header>
      <div className="admin-editor-review-link">
        <Link href={`/admin/review/${draft.revisionId}`}>
          Check Review readiness <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ContentForm mode="edit" action={saveDraftAction} draft={draft} />
      {growthNotesApplicable ? (
        <GrowthNotesSection
          contentId={draft.contentId}
          revisionId={draft.revisionId}
          notes={growthNotes}
        />
      ) : null}
      {reviewDetail ? (
        <ReviewActionPanel
          revision={reviewDetail.revision}
          ready={reviewDetail.report.ready}
        />
      ) : null}
    </main>
  );
}
