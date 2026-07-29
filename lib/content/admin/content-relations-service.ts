import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RelationType } from "@/types";

import type {
  ContentRelationCreateInput,
  ContentRelationDeleteInput,
  ContentRelationEditableFields,
  ContentRelationListItem,
  ContentRelationTargetOption,
  ContentRelationsManagementService,
} from "./content-relations-contracts";
import {
  ContentRelationsRepositoryError,
  createContentRelationsRepository,
  type ContentRelationsRepository,
  type ContentRelationsRepositoryClient,
} from "./content-relations-repository";

type AuthorizeContentRelationsRequest = () => Promise<AuthenticatedUser>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RELATION_TYPES = ["grewInto", "grewFrom", "relatedTo"] as const;

export class ContentRelationsManagementUnavailableError extends Error {
  constructor() {
    super("Content Relations are temporarily unavailable.");
    this.name = "ContentRelationsManagementUnavailableError";
  }
}

export class ContentRelationInputError extends Error {
  readonly field: string;

  constructor(field = "contentRelation") {
    super("The Content Relation input is invalid.");
    this.name = "ContentRelationInputError";
    this.field = field;
  }
}

export class ContentRelationContentUnavailableError extends Error {
  readonly field: string;

  constructor(field = "targetContentId") {
    super("The selected content is unavailable.");
    this.name = "ContentRelationContentUnavailableError";
    this.field = field;
  }
}

export class ContentRelationDuplicateError extends Error {
  constructor() {
    super("That Content Relation already exists.");
    this.name = "ContentRelationDuplicateError";
  }
}

export class ContentRelationNotFoundError extends Error {
  constructor() {
    super("The selected Content Relation is unavailable.");
    this.name = "ContentRelationNotFoundError";
  }
}

export type ContentRelationsManagementServiceDependencies = {
  authorize?: AuthorizeContentRelationsRequest;
  repository?: ContentRelationsRepository;
  repositoryFactory?: () => Promise<ContentRelationsRepository>;
};

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new ContentRelationInputError(field);
}

function isRelationType(value: unknown): value is RelationType {
  return RELATION_TYPES.includes(value as RelationType);
}

function normalizeText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeFields(
  input: ContentRelationEditableFields,
): ContentRelationEditableFields {
  assertUuid(input.targetContentId, "targetContentId");
  if (!isRelationType(input.relationType)) {
    throw new ContentRelationInputError("relationType");
  }

  return {
    targetContentId: input.targetContentId,
    relationType: input.relationType,
    noteZh: normalizeText(input.noteZh),
    noteEn: normalizeText(input.noteEn),
  };
}

async function createDefaultRepository(): Promise<ContentRelationsRepository> {
  try {
    const client = await createClient();
    return createContentRelationsRepository(
      client as unknown as ContentRelationsRepositoryClient,
    );
  } catch {
    throw new ContentRelationsManagementUnavailableError();
  }
}

export function createContentRelationsManagementService(
  dependencies: ContentRelationsManagementServiceDependencies = {},
): ContentRelationsManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<ContentRelationsRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<ContentRelationsRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function assertExistingContentIds(
    sourceContentId: string,
    targetContentId?: string,
  ): Promise<void> {
    const requestedIds = targetContentId
      ? [sourceContentId, targetContentId]
      : [sourceContentId];
    const existingIds = await (await getRepository()).getExistingContentIds(
      requestedIds,
    );

    if (!existingIds.has(sourceContentId)) {
      throw new ContentRelationContentUnavailableError("sourceContentId");
    }
    if (targetContentId && !existingIds.has(targetContentId)) {
      throw new ContentRelationContentUnavailableError("targetContentId");
    }
  }

  async function listOutgoingRelations(
    sourceContentId: string,
  ): Promise<ContentRelationListItem[]> {
    assertUuid(sourceContentId, "sourceContentId");
    await authorize();

    try {
      await assertExistingContentIds(sourceContentId);
      return await (await getRepository()).listOutgoingRelations(sourceContentId);
    } catch (error) {
      if (
        error instanceof ContentRelationInputError ||
        error instanceof ContentRelationContentUnavailableError
      ) {
        throw error;
      }
      if (
        error instanceof ContentRelationsRepositoryError ||
        error instanceof ContentRelationsManagementUnavailableError
      ) {
        throw new ContentRelationsManagementUnavailableError();
      }
      throw error;
    }
  }

  async function listRelationTargets(
    sourceContentId: string,
  ): Promise<ContentRelationTargetOption[]> {
    assertUuid(sourceContentId, "sourceContentId");
    await authorize();

    try {
      await assertExistingContentIds(sourceContentId);
      return await (await getRepository()).listRelationTargets(sourceContentId);
    } catch (error) {
      if (
        error instanceof ContentRelationInputError ||
        error instanceof ContentRelationContentUnavailableError
      ) {
        throw error;
      }
      if (
        error instanceof ContentRelationsRepositoryError ||
        error instanceof ContentRelationsManagementUnavailableError
      ) {
        throw new ContentRelationsManagementUnavailableError();
      }
      throw error;
    }
  }

  async function createRelation(
    input: ContentRelationCreateInput,
  ): Promise<ContentRelationListItem> {
    assertUuid(input.sourceContentId, "sourceContentId");
    const fields = normalizeFields(input);
    if (input.sourceContentId === fields.targetContentId) {
      throw new ContentRelationInputError("targetContentId");
    }
    await authorize();

    try {
      await assertExistingContentIds(input.sourceContentId, fields.targetContentId);
      const duplicate = await (await getRepository()).findDuplicateRelation({
        sourceContentId: input.sourceContentId,
        ...fields,
      });
      if (duplicate) throw new ContentRelationDuplicateError();

      return await (await getRepository()).createRelation(
        input.sourceContentId,
        fields,
      );
    } catch (error) {
      if (
        error instanceof ContentRelationInputError ||
        error instanceof ContentRelationContentUnavailableError ||
        error instanceof ContentRelationDuplicateError
      ) {
        throw error;
      }
      if (error instanceof ContentRelationsRepositoryError) {
        throw new ContentRelationsManagementUnavailableError();
      }
      throw error;
    }
  }

  async function deleteRelation(
    input: ContentRelationDeleteInput,
  ): Promise<void> {
    assertUuid(input.sourceContentId, "sourceContentId");
    assertUuid(input.relationId, "relationId");
    await authorize();

    try {
      await assertExistingContentIds(input.sourceContentId);
      const deleted = await (await getRepository()).deleteRelation(
        input.sourceContentId,
        input.relationId,
      );
      if (!deleted) throw new ContentRelationNotFoundError();
    } catch (error) {
      if (
        error instanceof ContentRelationInputError ||
        error instanceof ContentRelationContentUnavailableError ||
        error instanceof ContentRelationNotFoundError
      ) {
        throw error;
      }
      if (error instanceof ContentRelationsRepositoryError) {
        throw new ContentRelationsManagementUnavailableError();
      }
      throw error;
    }
  }

  return {
    listOutgoingRelations,
    listRelationTargets,
    createRelation,
    deleteRelation,
  };
}

let defaultContentRelationsManagementService:
  | ContentRelationsManagementService
  | null = null;

function getDefaultContentRelationsManagementService(): ContentRelationsManagementService {
  defaultContentRelationsManagementService ??=
    createContentRelationsManagementService();
  return defaultContentRelationsManagementService;
}

export function listOutgoingContentRelations(
  sourceContentId: string,
): Promise<ContentRelationListItem[]> {
  return getDefaultContentRelationsManagementService().listOutgoingRelations(
    sourceContentId,
  );
}

export function listContentRelationTargets(
  sourceContentId: string,
): Promise<ContentRelationTargetOption[]> {
  return getDefaultContentRelationsManagementService().listRelationTargets(
    sourceContentId,
  );
}

export function createContentRelation(
  input: ContentRelationCreateInput,
): Promise<ContentRelationListItem> {
  return getDefaultContentRelationsManagementService().createRelation(input);
}

export function deleteContentRelation(
  input: ContentRelationDeleteInput,
): Promise<void> {
  return getDefaultContentRelationsManagementService().deleteRelation(input);
}
