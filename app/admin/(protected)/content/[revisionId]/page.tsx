import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createAdminContentService,
  listContentRelationTargets,
  getReviewWorkspaceDetail,
  listGrowthNotes,
  listOutgoingContentRelations,
} from "@/lib/content/admin";
import { requiresGrowthStage } from "@/lib/content/validation";

import { saveDraftAction } from "../actions";
import { ContentForm } from "../content-form";
import { ContentRelationsSection } from "../content-relations-section";
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
  const [contentRelations, relationTargets] = await Promise.all([
    listOutgoingContentRelations(draft.contentId),
    listContentRelationTargets(draft.contentId),
  ]);
  const title = draft.titleEn?.trim() || draft.titleZh?.trim() || "未命名草稿";

  return (
    <main id="admin-main" className="admin-main admin-editor-main">
      <Link className="admin-back-link" href="/admin/content">
        <span aria-hidden="true">←</span> 内容管理
      </Link>
      <header className="admin-page-header admin-editor-header">
        <div>
          <p>草稿编辑器</p>
          <h1>{title}</h1>
          <span>使用结构化字段编辑内容。</span>
        </div>
        <dl className="admin-revision-card" aria-label="当前修订">
          <div>
            <dt>当前修订</dt>
            <dd>变更 {draft.lockVersion}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{draft.sourceVersionId ? "已发布版本" : "新内容"}</dd>
          </div>
          <div>
            <dt>上次保存</dt>
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
          检查审核准备情况 <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ContentForm mode="edit" action={saveDraftAction} draft={draft} />
      <ContentRelationsSection
        sourceContentId={draft.contentId}
        revisionId={draft.revisionId}
        relations={contentRelations}
        targets={relationTargets}
      />
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
