import "server-only";

import type { GrowthStage } from "@/types";

export type GrowthNoteListItem = Readonly<{
  id: string;
  contentId: string;
  fromStage: GrowthStage | null;
  toStage: GrowthStage;
  noteZh: string | null;
  noteEn: string | null;
  occurredAt: string;
  isPublic: boolean;
  createdAt: string;
}>;

export type GrowthNoteEditableFields = Readonly<{
  fromStage: GrowthStage | null;
  toStage: GrowthStage;
  noteZh: string | null;
  noteEn: string | null;
  occurredAt: string;
  isPublic: boolean;
}>;

export type GrowthNoteCreateInput = GrowthNoteEditableFields &
  Readonly<{
    contentId: string;
  }>;

export type GrowthNoteUpdateInput = GrowthNoteEditableFields &
  Readonly<{
    contentId: string;
    noteId: string;
  }>;

export type GrowthNoteDeleteInput = Readonly<{
  contentId: string;
  noteId: string;
}>;

export interface GrowthNotesManagementService {
  listGrowthNotes(contentId: string): Promise<GrowthNoteListItem[]>;
  createGrowthNote(input: GrowthNoteCreateInput): Promise<GrowthNoteListItem>;
  updateGrowthNote(input: GrowthNoteUpdateInput): Promise<GrowthNoteListItem>;
  deleteGrowthNote(input: GrowthNoteDeleteInput): Promise<void>;
}
