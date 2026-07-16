import { createMediaWorkspaceService } from "@/lib/content/admin";

import { replaceDraftCoverAction } from "./actions";
import { MediaWorkspace } from "./media-workspace";

export default async function AdminMediaPage() {
  const workspace = await createMediaWorkspaceService().getWorkspace();

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper · Media</p>
        <h1>Seed library</h1>
        <span>
          Tend cover objects, their garden uses, and their resting state without removing what came before.
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

