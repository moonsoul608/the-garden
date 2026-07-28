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
            {note.status === "unread" ? "Unread note" : "Read note"}
          </p>
          <h2>{note.name ?? "Anonymous visitor"}</h2>
        </div>
        <span className={`admin-note-status admin-note-status--${note.status}`}>
          {note.status}
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
      <h2>No visitor notes yet.</h2>
      <p>Private notes will gather here after visitors send them.</p>
    </section>
  );
}

function UnavailableState() {
  return (
    <section className="admin-lifecycle-unavailable" role="alert">
      <span aria-hidden="true">·</span>
      <h2>Visitor notes are quiet for now.</h2>
      <p>
        Private notes could not be loaded safely. No note details were exposed
        and no action was run.
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
        <h1>Visitor Notes</h1>
        <span>Private notes sent from the public garden.</span>
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
                  <p className="admin-section-kicker">Private inbox</p>
                  <h2 id="visitor-notes-summary-title">Notes at a glance</h2>
                </div>
              </div>
              <dl className="admin-note-summary-grid">
                <div>
                  <dt>Total</dt>
                  <dd>{notes.length}</dd>
                </div>
                <div>
                  <dt>Unread</dt>
                  <dd>{unreadCount}</dd>
                </div>
              </dl>
            </section>

            {notes.length === 0 ? (
              <EmptyState />
            ) : (
              <section className="admin-note-list" aria-label="Visitor notes">
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
