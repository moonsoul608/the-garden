import {
  getHomeCurationWorkspace,
  HomeCurationManagementUnavailableError,
  type HomeCurationWorkspace,
} from "@/lib/content/admin";

import { HomeCurationForm } from "./home-curation-form";

function UnavailableState() {
  return (
    <section className="admin-lifecycle-unavailable" role="alert">
      <span aria-hidden="true">.</span>
      <h2>首页精选暂不可用。</h2>
      <p>
        首页精选无法安全加载。首页内容行未被更改。
      </p>
    </section>
  );
}

function HomeCurationWorkspaceView({
  workspace,
}: Readonly<{ workspace: HomeCurationWorkspace }>) {
  const selectedCount =
    workspace.slots.currentlyGrowing.length +
    workspace.slots.recentlyPlanted.length;

  return (
    <div className="admin-home-curation-workspace">
      <section
        className="admin-dashboard-section admin-home-curation-summary"
        aria-labelledby="home-curation-summary-title"
      >
        <div className="admin-section-heading admin-section-heading--compact">
          <div>
            <p className="admin-section-kicker">首页</p>
            <h2 id="home-curation-summary-title">精选概览</h2>
          </div>
        </div>
        <dl className="admin-note-summary-grid">
          <div>
            <dt>可选已发布内容</dt>
            <dd>{workspace.options.length}</dd>
          </div>
          <div>
            <dt>已选行</dt>
            <dd>{selectedCount}</dd>
          </div>
        </dl>
      </section>

      <HomeCurationForm
        currentlyGrowing={workspace.slots.currentlyGrowing}
        recentlyPlanted={workspace.slots.recentlyPlanted}
        options={workspace.options}
      />
    </div>
  );
}

export default async function AdminHomeCurationPage() {
  let workspace: HomeCurationWorkspace | null = null;

  try {
    workspace = await getHomeCurationWorkspace();
  } catch (error) {
    if (!(error instanceof HomeCurationManagementUnavailableError)) {
      throw error;
    }
  }

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>首页精选</h1>
        <span>选择要显示在首页的已发布内容。</span>
      </header>

      {workspace ? (
        <HomeCurationWorkspaceView workspace={workspace} />
      ) : (
        <UnavailableState />
      )}
    </main>
  );
}
