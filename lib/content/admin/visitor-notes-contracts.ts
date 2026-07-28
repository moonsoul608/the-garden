export type VisitorNoteStatus = "read" | "unread";

export type VisitorNoteListItem = Readonly<{
  id: string;
  name: string | null;
  message: string;
  status: VisitorNoteStatus;
  createdAt: string;
}>;

export type VisitorNoteMutationInput = Readonly<{
  noteId: string;
}>;

export type VisitorNoteReadStateInput = VisitorNoteMutationInput &
  Readonly<{
    isRead: boolean;
  }>;

export interface VisitorNotesManagementService {
  listVisitorNotes(): Promise<VisitorNoteListItem[]>;
  markVisitorNoteReadState(input: VisitorNoteReadStateInput): Promise<void>;
  deleteVisitorNote(input: VisitorNoteMutationInput): Promise<void>;
}
