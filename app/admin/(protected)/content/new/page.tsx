import Link from "next/link";

import { createDraftAction } from "../actions";
import { ContentForm } from "../content-form";

export default function NewAdminContentPage() {
  return (
    <main id="admin-main" className="admin-main admin-editor-main">
      <Link className="admin-back-link" href="/admin/content">
        <span aria-hidden="true">←</span> Content workbench
      </Link>
      <header className="admin-page-header">
        <p>New planting</p>
        <h1>Create a Draft</h1>
        <span>Begin with editable content only. Identity and timestamps are kept server-side.</span>
      </header>
      <ContentForm mode="create" action={createDraftAction} />
    </main>
  );
}
