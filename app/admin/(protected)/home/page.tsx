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
      <h2>Home curation is quiet for now.</h2>
      <p>
        Homepage curation could not be loaded safely. No homepage rows were
        changed.
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
            <p className="admin-section-kicker">Homepage</p>
            <h2 id="home-curation-summary-title">Curation at a glance</h2>
          </div>
        </div>
        <dl className="admin-note-summary-grid">
          <div>
            <dt>Published options</dt>
            <dd>{workspace.options.length}</dd>
          </div>
          <div>
            <dt>Selected rows</dt>
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
        <h1>Home Curation</h1>
        <span>Choose the Published content that appears on the homepage.</span>
      </header>

      {workspace ? (
        <HomeCurationWorkspaceView workspace={workspace} />
      ) : (
        <UnavailableState />
      )}
    </main>
  );
}
