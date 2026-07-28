import { createPublicPageMetadata } from "@/lib/seo";

import { LeaveNoteExperience } from "./leave-note-experience";
import "./leave-note.css";

export const metadata = createPublicPageMetadata({
  title: "Leave a Note",
  description: "Send a private note to the garden owner.",
  path: "/leave-a-note",
});

export default function LeaveNotePage() {
  return <LeaveNoteExperience />;
}

