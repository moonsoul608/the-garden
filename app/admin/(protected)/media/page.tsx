import { createMediaWorkspaceService } from "@/lib/content/admin";

import { replaceDraftCoverAction } from "./actions";
import { MediaWorkspace } from "./media-workspace";

export default async function AdminMediaPage() {
  const workspace = await createMediaWorkspaceService().getWorkspace();

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper · 媒体库</p>
        <h1>媒体库</h1>
        <span>
          管理封面对象、使用情况和引用状态，不删除既有历史。
        </span>
      </header>

      <MediaWorkspace
        media={workspace.media}
        draftTargets={workspace.draftTargets}
        action={replaceDraftCoverAction}
      />
    </main>
  );
}

