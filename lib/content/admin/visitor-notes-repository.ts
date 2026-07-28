import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, VisitorNoteDatabaseRow } from "@/types/database";

import type { VisitorNoteListItem } from "./visitor-notes-contracts";

export class VisitorNotesRepositoryError extends Error {
  constructor() {
    super("Visitor notes could not be loaded safely.");
    this.name = "VisitorNotesRepositoryError";
  }
}

export interface VisitorNotesRepository {
  listVisitorNotes(): Promise<VisitorNoteListItem[]>;
  markVisitorNoteReadState(noteId: string, isRead: boolean): Promise<void>;
  deleteVisitorNote(noteId: string): Promise<void>;
}

type VisitorNotesRepositoryClient = SupabaseClient<ContentDatabase>;

function mapVisitorNote(row: VisitorNoteDatabaseRow): VisitorNoteListItem {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    status: row.is_read ? "read" : "unread",
    createdAt: row.created_at,
  };
}

export function createVisitorNotesRepository(
  client: VisitorNotesRepositoryClient,
): VisitorNotesRepository {
  async function listVisitorNotes(): Promise<VisitorNoteListItem[]> {
    const result = await client
      .from("visitor_notes")
      .select("id,name,message,is_read,created_at")
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false });

    if (result.error) throw new VisitorNotesRepositoryError();
    return (result.data ?? []).map(mapVisitorNote);
  }

  async function markVisitorNoteReadState(
    noteId: string,
    isRead: boolean,
  ): Promise<void> {
    const result = await client
      .from("visitor_notes")
      .update({ is_read: isRead })
      .eq("id", noteId);

    if (result.error) throw new VisitorNotesRepositoryError();
  }

  async function deleteVisitorNote(noteId: string): Promise<void> {
    const result = await client.from("visitor_notes").delete().eq("id", noteId);

    if (result.error) throw new VisitorNotesRepositoryError();
  }

  return { listVisitorNotes, markVisitorNoteReadState, deleteVisitorNote };
}

export type { VisitorNotesRepositoryClient };
