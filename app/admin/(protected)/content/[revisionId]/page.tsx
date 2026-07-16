import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminContentService } from "@/lib/content/admin";

import { saveDraftAction } from "../actions";
import { ContentForm } from "../content-form";

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
    </main>
  );
}
