"use client";

import { useEffect, useState } from "react";

import {
  LOCAL_NOTE_RECEIPTS_CHANGED_EVENT,
  readLocalNoteReceipts,
  type LocalNoteReceipt,
} from "@/lib/local-note-receipts";

function sentLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sent recently";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function YourNotesSection() {
  const [receipts, setReceipts] = useState<LocalNoteReceipt[]>([]);

  useEffect(() => {
    const syncReceipts = () => setReceipts(readLocalNoteReceipts());
    syncReceipts();
    window.addEventListener(LOCAL_NOTE_RECEIPTS_CHANGED_EVENT, syncReceipts);
    window.addEventListener("storage", syncReceipts);
    return () => {
      window.removeEventListener(
        LOCAL_NOTE_RECEIPTS_CHANGED_EVENT,
        syncReceipts,
      );
      window.removeEventListener("storage", syncReceipts);
    };
  }, []);

  return (
    <section
      className="saved-paths-section your-notes-section"
      aria-labelledby="your-notes-title"
    >
      <div className="collection-heading">
        <div>
          <p className="eyebrow">Current device</p>
          <h2 id="your-notes-title">Your Notes</h2>
        </div>
        <p className="result-count" aria-live="polite" aria-atomic="true">
          {receipts.length} {receipts.length === 1 ? "note" : "notes"}
        </p>
      </div>

      {receipts.length ? (
        <div className="your-notes-list">
          {receipts.map((receipt, index) => (
            <article
              className="your-note-receipt card"
              key={`${receipt.sentAt}-${index}`}
            >
              <p className="eyebrow">Private note sent</p>
              {receipt.excerpt ? <p>{receipt.excerpt}</p> : null}
              <footer>
                <time dateTime={receipt.sentAt}>
                  {sentLabel(receipt.sentAt)}
                </time>
                <span>Remembered only on this device.</span>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="saved-paths-empty card" role="status">
          <span aria-hidden="true">✉</span>
          <h3>No local note receipts yet.</h3>
          <p>
            After you send a private note, this browser can remember that it
            happened.
          </p>
        </div>
      )}
    </section>
  );
}
