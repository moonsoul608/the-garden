import {
  listVisitorNotes,
  VisitorNotesManagementUnavailableError,
  type VisitorNoteListItem,
} from "@/lib/content/admin";

import { NoteActions } from "./note-actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function NoteCard({ note }: Readonly<{ note: VisitorNoteListItem }>) {
  return (
    <article className="admin-note-card">
      <header className="admin-note-card-header">
        <div>
          <p className="admin-section-kicker">
            {note.status === "unread" ? "未读留言" : "已读留言"}
          </p>
          <h2>{note.name ?? "匿名访客"}</h2>
        </div>
        <span className={`admin-note-status admin-note-status--${note.status}`}>
          {note.status === "unread" ? "未读" : "已读"}
        </span>
      </header>

      <p className="admin-note-message">{note.message}</p>

      <footer className="admin-note-card-footer">
        <time dateTime={note.createdAt}>
          {dateFormatter.format(new Date(note.createdAt))}
        </time>
        <NoteActions note={note} />
      </footer>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="admin-empty-state">
      <p className="admin-empty-symbol" aria-hidden="true">
        ·
      </p>
      <h2>还没有访客留言。</h2>
      <p>访客发送的私密留言会显示在这里。</p>
    </section>
  );
}

function UnavailableState() {
  return (
    <section className="admin-lifecycle-unavailable" role="alert">
      <span aria-hidden="true">·</span>
      <h2>访客留言暂不可用。</h2>
      <p>
        私密留言无法安全加载。留言详情未显示，也没有执行任何操作。
      </p>
    </section>
  );
}

export default async function AdminVisitorNotesPage() {
  let notes: VisitorNoteListItem[] | null = null;

  try {
    notes = await listVisitorNotes();
  } catch (error) {
    if (!(error instanceof VisitorNotesManagementUnavailableError)) {
      throw error;
    }
  }

  const unreadCount =
    notes?.filter((note) => note.status === "unread").length ?? 0;

  return (
    <main id="admin-main" className="admin-main">
      <header className="admin-page-header">
        <p>Garden Keeper</p>
        <h1>访客留言</h1>
        <span>从公开站点发送的私密留言。</span>
      </header>

      <div className="admin-notes-workspace">
        {notes ? (
          <>
            <section
              className="admin-dashboard-section admin-notes-summary"
              aria-labelledby="visitor-notes-summary-title"
            >
              <div className="admin-section-heading admin-section-heading--compact">
                <div>
                  <p className="admin-section-kicker">私密收件箱</p>
                  <h2 id="visitor-notes-summary-title">留言概览</h2>
                </div>
              </div>
              <dl className="admin-note-summary-grid">
                <div>
                  <dt>总数</dt>
                  <dd>{notes.length}</dd>
                </div>
                <div>
                  <dt>未读</dt>
                  <dd>{unreadCount}</dd>
                </div>
              </dl>
            </section>

            {notes.length === 0 ? (
              <EmptyState />
            ) : (
              <section className="admin-note-list" aria-label="访客留言">
                {notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </section>
            )}
          </>
        ) : (
          <UnavailableState />
        )}
      </div>
    </main>
  );
}
