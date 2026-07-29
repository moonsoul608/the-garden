import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, GrowthNoteDatabaseRow } from "@/types/database";
import type { ContentType, GrowthStage, RegionName } from "@/types";

import type {
  GrowthNoteEditableFields,
  GrowthNoteListItem,
} from "./growth-notes-contracts";

export type GrowthNoteContentSummary = Readonly<{
  id: string;
  region: RegionName;
  contentType: ContentType;
  growthStage: GrowthStage | null;
}>;

export class GrowthNotesRepositoryError extends Error {
  constructor() {
    super("Growth Notes could not be changed safely.");
    this.name = "GrowthNotesRepositoryError";
  }
}

export interface GrowthNotesRepository {
  getContentSummary(contentId: string): Promise<GrowthNoteContentSummary | null>;
  listGrowthNotes(contentId: string): Promise<GrowthNoteListItem[]>;
  createGrowthNote(
    contentId: string,
    fields: GrowthNoteEditableFields,
  ): Promise<GrowthNoteListItem>;
  updateGrowthNote(
    contentId: string,
    noteId: string,
    fields: GrowthNoteEditableFields,
  ): Promise<GrowthNoteListItem | null>;
  deleteGrowthNote(contentId: string, noteId: string): Promise<boolean>;
}

type GrowthNotesRepositoryClient = SupabaseClient<ContentDatabase>;

function mapGrowthNote(row: GrowthNoteDatabaseRow): GrowthNoteListItem {
  return {
    id: row.id,
    contentId: row.content_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    noteZh: row.note_zh,
    noteEn: row.note_en,
    occurredAt: row.occurred_at,
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

function toDatabaseFields(
  fields: GrowthNoteEditableFields,
): Pick<
  GrowthNoteDatabaseRow,
  "from_stage" | "to_stage" | "note_zh" | "note_en" | "occurred_at" | "is_public"
> {
  return {
    from_stage: fields.fromStage,
    to_stage: fields.toStage,
    note_zh: fields.noteZh,
    note_en: fields.noteEn,
    occurred_at: fields.occurredAt,
    is_public: fields.isPublic,
  };
}

export function createGrowthNotesRepository(
  client: GrowthNotesRepositoryClient,
): GrowthNotesRepository {
  async function getContentSummary(
    contentId: string,
  ): Promise<GrowthNoteContentSummary | null> {
    const result = await client
      .from("contents")
      .select("id,region,content_type,growth_stage")
      .eq("id", contentId)
      .maybeSingle();

    if (result.error) throw new GrowthNotesRepositoryError();
    if (!result.data) return null;

    return {
      id: result.data.id,
      region: result.data.region,
      contentType: result.data.content_type,
      growthStage: result.data.growth_stage,
    };
  }

  async function listGrowthNotes(
    contentId: string,
  ): Promise<GrowthNoteListItem[]> {
    const result = await client
      .from("growth_notes")
      .select("*")
      .eq("content_id", contentId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (result.error) throw new GrowthNotesRepositoryError();
    return ((result.data ?? []) as GrowthNoteDatabaseRow[]).map(mapGrowthNote);
  }

  async function createGrowthNote(
    contentId: string,
    fields: GrowthNoteEditableFields,
  ): Promise<GrowthNoteListItem> {
    const result = await client
      .from("growth_notes")
      .insert({ content_id: contentId, ...toDatabaseFields(fields) })
      .select("*")
      .single();

    if (result.error || !result.data) throw new GrowthNotesRepositoryError();
    return mapGrowthNote(result.data as GrowthNoteDatabaseRow);
  }

  async function updateGrowthNote(
    contentId: string,
    noteId: string,
    fields: GrowthNoteEditableFields,
  ): Promise<GrowthNoteListItem | null> {
    const result = await client
      .from("growth_notes")
      .update(toDatabaseFields(fields))
      .eq("id", noteId)
      .eq("content_id", contentId)
      .select("*")
      .maybeSingle();

    if (result.error) throw new GrowthNotesRepositoryError();
    return result.data ? mapGrowthNote(result.data as GrowthNoteDatabaseRow) : null;
  }

  async function deleteGrowthNote(
    contentId: string,
    noteId: string,
  ): Promise<boolean> {
    const result = await client
      .from("growth_notes")
      .delete()
      .eq("id", noteId)
      .eq("content_id", contentId)
      .select("id")
      .maybeSingle();

    if (result.error) throw new GrowthNotesRepositoryError();
    return Boolean(result.data);
  }

  return {
    getContentSummary,
    listGrowthNotes,
    createGrowthNote,
    updateGrowthNote,
    deleteGrowthNote,
  };
}

export type { GrowthNotesRepositoryClient };
