import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  VisitorNoteListItem,
  VisitorNoteMutationInput,
  VisitorNoteReadStateInput,
  VisitorNotesManagementService,
} from "./visitor-notes-contracts";
import {
  createVisitorNotesRepository,
  VisitorNotesRepositoryError,
  type VisitorNotesRepository,
  type VisitorNotesRepositoryClient,
} from "./visitor-notes-repository";

type AuthorizeVisitorNotesRequest = () => Promise<AuthenticatedUser>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class VisitorNotesManagementUnavailableError extends Error {
  constructor() {
    super("访客留言暂时不可用。");
    this.name = "VisitorNotesManagementUnavailableError";
  }
}

export class VisitorNoteInputError extends Error {
  constructor() {
    super("所选访客留言不可用。");
    this.name = "VisitorNoteInputError";
  }
}

export type VisitorNotesManagementServiceDependencies = {
  authorize?: AuthorizeVisitorNotesRequest;
  repository?: VisitorNotesRepository;
  repositoryFactory?: () => Promise<VisitorNotesRepository>;
};

function assertNoteId(noteId: string): void {
  if (!UUID_PATTERN.test(noteId)) throw new VisitorNoteInputError();
}

async function createDefaultRepository(): Promise<VisitorNotesRepository> {
  try {
    const client = await createClient();
    return createVisitorNotesRepository(
      client as unknown as VisitorNotesRepositoryClient,
    );
  } catch {
    throw new VisitorNotesManagementUnavailableError();
  }
}

export function createVisitorNotesManagementService(
  dependencies: VisitorNotesManagementServiceDependencies = {},
): VisitorNotesManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<VisitorNotesRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<VisitorNotesRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function listVisitorNotes(): Promise<VisitorNoteListItem[]> {
    await authorize();

    try {
      return await (await getRepository()).listVisitorNotes();
    } catch (error) {
      if (error instanceof VisitorNotesManagementUnavailableError) throw error;
      if (error instanceof VisitorNotesRepositoryError) {
        throw new VisitorNotesManagementUnavailableError();
      }
      throw new VisitorNotesManagementUnavailableError();
    }
  }

  async function markVisitorNoteReadState({
    noteId,
    isRead,
  }: VisitorNoteReadStateInput): Promise<void> {
    assertNoteId(noteId);
    await authorize();

    try {
      await (await getRepository()).markVisitorNoteReadState(noteId, isRead);
    } catch (error) {
      if (error instanceof VisitorNotesRepositoryError) {
        throw new VisitorNotesManagementUnavailableError();
      }
      throw error;
    }
  }

  async function deleteVisitorNote({
    noteId,
  }: VisitorNoteMutationInput): Promise<void> {
    assertNoteId(noteId);
    await authorize();

    try {
      await (await getRepository()).deleteVisitorNote(noteId);
    } catch (error) {
      if (error instanceof VisitorNotesRepositoryError) {
        throw new VisitorNotesManagementUnavailableError();
      }
      throw error;
    }
  }

  return { listVisitorNotes, markVisitorNoteReadState, deleteVisitorNote };
}

let defaultVisitorNotesManagementService:
  | VisitorNotesManagementService
  | null = null;

function getDefaultVisitorNotesManagementService(): VisitorNotesManagementService {
  defaultVisitorNotesManagementService ??=
    createVisitorNotesManagementService();
  return defaultVisitorNotesManagementService;
}

export function listVisitorNotes(): Promise<VisitorNoteListItem[]> {
  return getDefaultVisitorNotesManagementService().listVisitorNotes();
}

export function markVisitorNoteReadState(
  input: VisitorNoteReadStateInput,
): Promise<void> {
  return getDefaultVisitorNotesManagementService().markVisitorNoteReadState(
    input,
  );
}

export function deleteVisitorNote(
  input: VisitorNoteMutationInput,
): Promise<void> {
  return getDefaultVisitorNotesManagementService().deleteVisitorNote(input);
}
