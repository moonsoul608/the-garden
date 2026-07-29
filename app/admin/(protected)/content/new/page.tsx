import Link from "next/link";

import { createDraftAction } from "../actions";
import { ContentForm } from "../content-form";

export default function NewAdminContentPage() {
  return (
    <main id="admin-main" className="admin-main admin-editor-main">
      <Link className="admin-back-link" href="/admin/content">
        <span aria-hidden="true">←</span> 内容管理
      </Link>
      <header className="admin-page-header">
        <p>新建内容</p>
        <h1>创建草稿</h1>
        <span>这里只编辑内容字段。身份信息和时间戳由服务器保存。</span>
      </header>
      <ContentForm mode="create" action={createDraftAction} />
    </main>
  );
}
