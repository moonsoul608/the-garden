import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GrowthStage } from "@/types";
import {
  isGrowthStage,
  requiresGrowthStage,
  validateGrowthNote,
} from "@/lib/content/validation";

import type {
  GrowthNoteCreateInput,
  GrowthNoteDeleteInput,
  GrowthNoteEditableFields,
  GrowthNoteListItem,
  GrowthNoteUpdateInput,
  GrowthNotesManagementService,
} from "./growth-notes-contracts";
import {
  createGrowthNotesRepository,
  GrowthNotesRepositoryError,
  type GrowthNoteContentSummary,
  type GrowthNotesRepository,
  type GrowthNotesRepositoryClient,
} from "./growth-notes-repository";

type AuthorizeGrowthNotesRequest = () => Promise<AuthenticatedUser>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GrowthNotesManagementUnavailableError extends Error {
  constructor() {
    super("Growth Notes 暂时不可用。");
    this.name = "GrowthNotesManagementUnavailableError";
  }
}

export class GrowthNoteInputError extends Error {
  readonly field: string;

  constructor(field = "growthNote") {
    super("Growth Notes 输入无效。");
    this.name = "GrowthNoteInputError";
    this.field = field;
  }
}

export class GrowthNoteNotFoundError extends Error {
  constructor() {
    super("所选 Growth Notes 不可用。");
    this.name = "GrowthNoteNotFoundError";
  }
}

export class GrowthNoteContentUnavailableError extends Error {
  constructor() {
    super("所选内容不能添加 Growth Notes。");
    this.name = "GrowthNoteContentUnavailableError";
  }
}

export type GrowthNotesManagementServiceDependencies = {
  authorize?: AuthorizeGrowthNotesRequest;
  repository?: GrowthNotesRepository;
  repositoryFactory?: () => Promise<GrowthNotesRepository>;
};

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new GrowthNoteInputError(field);
}

function normalizeStage(
  value: GrowthStage | null,
  field: "fromStage" | "toStage",
): GrowthStage | null {
  if (value === null && field === "fromStage") return null;
  if (isGrowthStage(value)) return value;
  throw new GrowthNoteInputError(field);
}

function hasText(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeOccurredAt(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new GrowthNoteInputError("occurredAt");
  }
  return date.toISOString();
}

function assertGrowthTracked(content: GrowthNoteContentSummary): void {
  if (!requiresGrowthStage(content.region, content.contentType)) {
    throw new GrowthNoteContentUnavailableError();
  }
}

function normalizeFields(
  input: GrowthNoteEditableFields,
): GrowthNoteEditableFields {
  const toStage = normalizeStage(input.toStage, "toStage");
  if (toStage === null) throw new GrowthNoteInputError("toStage");

  const fields = {
    fromStage: normalizeStage(input.fromStage, "fromStage"),
    toStage,
    noteZh: normalizeText(input.noteZh),
    noteEn: normalizeText(input.noteEn),
    occurredAt: normalizeOccurredAt(input.occurredAt),
    isPublic: input.isPublic === true,
  };

  if (!hasText(fields.noteZh) && !hasText(fields.noteEn)) {
    throw new GrowthNoteInputError("growthNote");
  }

  const validation = validateGrowthNote({
    contentId: "pending",
    fromStage: fields.fromStage,
    toStage: fields.toStage,
    noteZh: fields.noteZh,
    noteEn: fields.noteEn,
    isPublic: fields.isPublic,
  });
  if (!validation.valid) {
    throw new GrowthNoteInputError(validation.issues[0]?.field ?? "growthNote");
  }

  return fields;
}

async function createDefaultRepository(): Promise<GrowthNotesRepository> {
  try {
    const client = await createClient();
    return createGrowthNotesRepository(
      client as unknown as GrowthNotesRepositoryClient,
    );
  } catch {
    throw new GrowthNotesManagementUnavailableError();
  }
}

export function createGrowthNotesManagementService(
  dependencies: GrowthNotesManagementServiceDependencies = {},
): GrowthNotesManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<GrowthNotesRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<GrowthNotesRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function requireEditableContent(
    contentId: string,
  ): Promise<GrowthNoteContentSummary> {
    assertUuid(contentId, "contentId");
    const repository = await getRepository();
    const content = await repository.getContentSummary(contentId);
    if (!content) throw new GrowthNoteContentUnavailableError();
    assertGrowthTracked(content);
    return content;
  }

  async function listGrowthNotes(
    contentId: string,
  ): Promise<GrowthNoteListItem[]> {
    assertUuid(contentId, "contentId");
    await authorize();

    try {
      await requireEditableContent(contentId);
      return await (await getRepository()).listGrowthNotes(contentId);
    } catch (error) {
      if (
        error instanceof GrowthNoteInputError ||
        error instanceof GrowthNoteContentUnavailableError
      ) {
        throw error;
      }
      if (
        error instanceof GrowthNotesManagementUnavailableError ||
        error instanceof GrowthNotesRepositoryError
      ) {
        throw new GrowthNotesManagementUnavailableError();
      }
      throw new GrowthNotesManagementUnavailableError();
    }
  }

  async function createGrowthNote(
    input: GrowthNoteCreateInput,
  ): Promise<GrowthNoteListItem> {
    assertUuid(input.contentId, "contentId");
    const fields = normalizeFields(input);
    await authorize();

    try {
      await requireEditableContent(input.contentId);
      return await (await getRepository()).createGrowthNote(
        input.contentId,
        fields,
      );
    } catch (error) {
      if (
        error instanceof GrowthNoteInputError ||
        error instanceof GrowthNoteContentUnavailableError
      ) {
        throw error;
      }
      if (error instanceof GrowthNotesRepositoryError) {
        throw new GrowthNotesManagementUnavailableError();
      }
      throw error;
    }
  }

  async function updateGrowthNote(
    input: GrowthNoteUpdateInput,
  ): Promise<GrowthNoteListItem> {
    assertUuid(input.contentId, "contentId");
    assertUuid(input.noteId, "noteId");
    const fields = normalizeFields(input);
    await authorize();

    try {
      await requireEditableContent(input.contentId);
      const note = await (await getRepository()).updateGrowthNote(
        input.contentId,
        input.noteId,
        fields,
      );
      if (!note) throw new GrowthNoteNotFoundError();
      return note;
    } catch (error) {
      if (
        error instanceof GrowthNoteInputError ||
        error instanceof GrowthNoteContentUnavailableError ||
        error instanceof GrowthNoteNotFoundError
      ) {
        throw error;
      }
      if (error instanceof GrowthNotesRepositoryError) {
        throw new GrowthNotesManagementUnavailableError();
      }
      throw error;
    }
  }

  async function deleteGrowthNote(input: GrowthNoteDeleteInput): Promise<void> {
    assertUuid(input.contentId, "contentId");
    assertUuid(input.noteId, "noteId");
    await authorize();

    try {
      await requireEditableContent(input.contentId);
      const deleted = await (await getRepository()).deleteGrowthNote(
        input.contentId,
        input.noteId,
      );
      if (!deleted) throw new GrowthNoteNotFoundError();
    } catch (error) {
      if (
        error instanceof GrowthNoteInputError ||
        error instanceof GrowthNoteContentUnavailableError ||
        error instanceof GrowthNoteNotFoundError
      ) {
        throw error;
      }
      if (error instanceof GrowthNotesRepositoryError) {
        throw new GrowthNotesManagementUnavailableError();
      }
      throw error;
    }
  }

  return {
    listGrowthNotes,
    createGrowthNote,
    updateGrowthNote,
    deleteGrowthNote,
  };
}

let defaultGrowthNotesManagementService:
  | GrowthNotesManagementService
  | null = null;

function getDefaultGrowthNotesManagementService(): GrowthNotesManagementService {
  defaultGrowthNotesManagementService ??=
    createGrowthNotesManagementService();
  return defaultGrowthNotesManagementService;
}

export function listGrowthNotes(
  contentId: string,
): Promise<GrowthNoteListItem[]> {
  return getDefaultGrowthNotesManagementService().listGrowthNotes(contentId);
}

export function createGrowthNote(
  input: GrowthNoteCreateInput,
): Promise<GrowthNoteListItem> {
  return getDefaultGrowthNotesManagementService().createGrowthNote(input);
}

export function updateGrowthNote(
  input: GrowthNoteUpdateInput,
): Promise<GrowthNoteListItem> {
  return getDefaultGrowthNotesManagementService().updateGrowthNote(input);
}

export function deleteGrowthNote(input: GrowthNoteDeleteInput): Promise<void> {
  return getDefaultGrowthNotesManagementService().deleteGrowthNote(input);
}
