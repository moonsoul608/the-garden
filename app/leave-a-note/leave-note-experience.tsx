"use client";

import { FormEvent, useRef, useState } from "react";

import { saveLocalNoteReceipt } from "@/lib/local-note-receipts";
import {
  VISITOR_NOTE_MAX_MESSAGE_LENGTH,
  VISITOR_NOTE_MAX_NAME_LENGTH,
} from "@/lib/visitor-notes";

type ViewState = "idle" | "sending" | "success" | "error";
type VisitorNoteResponse =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function LeaveNoteExperience() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<ViewState>("idle");
  const [status, setStatus] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setState("error");
      setStatus("Please leave a note before sending.");
      messageRef.current?.focus();
      return;
    }

    setState("sending");
    setStatus("");

    try {
      const response = await fetch("/api/visitor-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, website }),
      });
      const payload = (await response.json()) as VisitorNoteResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "The note could not be sent." : payload.error);
      }

      saveLocalNoteReceipt(trimmedMessage);
      setName("");
      setMessage("");
      setWebsite("");
      setState("success");
      setStatus(payload.message);
    } catch (error) {
      setState("error");
      setStatus(
        error instanceof Error
          ? error.message
          : "The note could not be sent right now.",
      );
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="note-page">
      <section className="note-hero" aria-labelledby="leave-note-title">
        <div className="note-hero-copy">
          <p className="eyebrow">Private path</p>
          <h1 id="leave-note-title">Leave a Note</h1>
          <p className="tagline">Send a quiet note back to the garden.</p>
          <p>
            Notes are private. They do not become comments, replies, likes, or
            public discussion threads.
          </p>
        </div>

        <form className="note-form card" onSubmit={submitNote}>
          <div className="note-field">
            <label htmlFor="visitor-name">Name <span>optional</span></label>
            <input
              id="visitor-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={VISITOR_NOTE_MAX_NAME_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="note-field note-field-hidden" aria-hidden="true">
            <label htmlFor="visitor-website">Website</label>
            <input
              id="visitor-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <div className="note-field">
            <label htmlFor="visitor-message">Message</label>
            <textarea
              id="visitor-message"
              ref={messageRef}
              name="message"
              required
              rows={8}
              maxLength={VISITOR_NOTE_MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="note-meta">
              {message.length}/{VISITOR_NOTE_MAX_MESSAGE_LENGTH}
            </p>
          </div>

          <button
            className="button button-primary"
            type="submit"
            disabled={state === "sending"}
          >
            {state === "sending" ? "Sending..." : "Send note"}
          </button>
          <p
            className={`note-status note-status-${state}`}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        </form>
      </section>
    </main>
  );
}
