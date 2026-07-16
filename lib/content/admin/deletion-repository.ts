import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import type {
  DeleteArchivedContentInput,
  DeletionImpactCounts,
  DeletionImpactPreview,
  DeletionImpactRelation,
  DeletionReceipt,
  DeletionRedirectReference,
  DeletionRevisionStatus,
  PreviewDeletionImpactInput,
  TombstoneCreationResult,
} from "./contracts";
import {
  ContentMutationError,
  mapContentMutationDatabaseError,
} from "./errors";

export interface DeletionRepository {
  previewDeletionImpact(
    input: PreviewDeletionImpactInput,
  ): Promise<DeletionImpactPreview>;
  deleteArchivedContent(
    input: DeleteArchivedContentInput,
  ): Promise<DeletionReceipt>;
}

export type DeletionRepositoryClient = SupabaseClient<ContentDatabase>;

type JsonObject = { [key: string]: Json | undefined };

const RELATION_TYPES = new Set(["grewFrom", "grewInto", "relatedTo"]);
const INVALIDATION_SURFACES = new Set([
  "route",
  "metadata",
  "sitemap",
  "search",
]);

function isObject(value: Json | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: Json | undefined): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function mapRelation(value: Json): DeletionImpactRelation | null {
  if (!isObject(value)) return null;
  const { relationId, relatedContentId, relationType } = value;

  if (
    typeof relationId !== "string" ||
    typeof relatedContentId !== "string" ||
    typeof relationType !== "string" ||
    !RELATION_TYPES.has(relationType)
  ) {
    return null;
  }

  return {
    relationId,
    relatedContentId,
    relationType: relationType as DeletionImpactRelation["relationType"],
  };
}

function mapRedirect(value: Json): DeletionRedirectReference | null {
  if (!isObject(value)) return null;
  const { routePath, destinationPath, statusCode } = value;

  if (
    typeof routePath !== "string" ||
    (destinationPath !== null && typeof destinationPath !== "string") ||
    !isCount(statusCode)
  ) {
    return null;
  }

  return { routePath, destinationPath, statusCode };
}

function mapRevisionStatus(
  value: Json | undefined,
): DeletionRevisionStatus | null {
  if (!isObject(value)) return null;
  const { active, revisionId, lifecycle, lockVersion } = value;

  if (
    typeof active !== "boolean" ||
    (revisionId !== null && typeof revisionId !== "string") ||
    (lifecycle !== null && lifecycle !== "Draft" && lifecycle !== "Review") ||
    (lockVersion !== null && (!isCount(lockVersion) || lockVersion < 1)) ||
    (active &&
      (typeof revisionId !== "string" ||
        (lifecycle !== "Draft" && lifecycle !== "Review") ||
        typeof lockVersion !== "number")) ||
    (!active &&
      (revisionId !== null || lifecycle !== null || lockVersion !== null))
  ) {
    return null;
  }

  return { active, revisionId, lifecycle, lockVersion };
}

function mapImpactPreview(value: Json): DeletionImpactPreview {
  if (!isObject(value)) {
    throw new ContentMutationError("repository_failure", "previewDeletionImpact");
  }

  const {
    contentId,
    lifecycle,
    expectedArchivedToken,
    canonicalRoute,
    historicalRoutes,
    redirectReferences,
    versionCount,
    revisionStatus,
    inboundRelations,
    outboundRelations,
    storageReferenceCount,
    affectedInvalidationSurfaces,
    impactDigest,
  } = value;
  const mappedRevisionStatus = mapRevisionStatus(revisionStatus);
  const mappedRedirects = Array.isArray(redirectReferences)
    ? redirectReferences.map(mapRedirect)
    : [];
  const mappedInbound = Array.isArray(inboundRelations)
    ? inboundRelations.map(mapRelation)
    : [];
  const mappedOutbound = Array.isArray(outboundRelations)
    ? outboundRelations.map(mapRelation)
    : [];

  if (
    typeof contentId !== "string" ||
    lifecycle !== "Archived" ||
    typeof expectedArchivedToken !== "string" ||
    typeof canonicalRoute !== "string" ||
    !Array.isArray(historicalRoutes) ||
    !historicalRoutes.every((route) => typeof route === "string") ||
    !Array.isArray(redirectReferences) ||
    mappedRedirects.some((item) => item === null) ||
    !isCount(versionCount) ||
    !mappedRevisionStatus ||
    !Array.isArray(inboundRelations) ||
    mappedInbound.some((item) => item === null) ||
    !Array.isArray(outboundRelations) ||
    mappedOutbound.some((item) => item === null) ||
    !isCount(storageReferenceCount) ||
    !Array.isArray(affectedInvalidationSurfaces) ||
    !affectedInvalidationSurfaces.every(
      (surface) =>
        typeof surface === "string" && INVALIDATION_SURFACES.has(surface),
    ) ||
    typeof impactDigest !== "string" ||
    !/^[0-9a-f]{32}$/.test(impactDigest)
  ) {
    throw new ContentMutationError("repository_failure", "previewDeletionImpact");
  }

  return {
    contentId,
    lifecycle,
    expectedArchivedToken,
    canonicalRoute,
    historicalRoutes: [...historicalRoutes] as string[],
    redirectReferences: mappedRedirects as DeletionRedirectReference[],
    versionCount,
    revisionStatus: mappedRevisionStatus,
    inboundRelations: mappedInbound as DeletionImpactRelation[],
    outboundRelations: mappedOutbound as DeletionImpactRelation[],
    storageReferenceCount,
    affectedInvalidationSurfaces: [...affectedInvalidationSurfaces] as (
      | "route"
      | "metadata"
      | "sitemap"
      | "search"
    )[],
    impactDigest,
  };
}

const IMPACT_COUNT_KEYS = [
  "canonicalRouteCount",
  "historicalRouteCount",
  "redirectReferenceCount",
  "versionCount",
  "revisionCount",
  "inboundRelationCount",
  "outboundRelationCount",
  "storageReferenceCount",
  "invalidationSurfaceCount",
] as const satisfies readonly (keyof DeletionImpactCounts)[];

const TOMBSTONE_RESULT_KEYS = [
  "requestedCount",
  "createdCount",
  "insertedCount",
  "convertedCount",
] as const satisfies readonly (keyof TombstoneCreationResult)[];

function mapCounts<T extends Record<string, number>>(
  value: Json | undefined,
  keys: readonly (keyof T)[],
): T | null {
  if (!isObject(value) || !keys.every((key) => isCount(value[String(key)]))) {
    return null;
  }

  return Object.fromEntries(
    keys.map((key) => [key, value[String(key)] as number]),
  ) as T;
}

function mapDeletionReceipt(value: Json): DeletionReceipt {
  if (!isObject(value)) {
    throw new ContentMutationError("repository_failure", "deleteArchivedContent");
  }

  const {
    status,
    contentId,
    operationId,
    deletedAt,
    deletedBy,
    impactCounts,
    tombstoneResult,
  } = value;
  const mappedImpactCounts = mapCounts<DeletionImpactCounts>(
    impactCounts,
    IMPACT_COUNT_KEYS,
  );
  const mappedTombstoneResult = mapCounts<TombstoneCreationResult>(
    tombstoneResult,
    TOMBSTONE_RESULT_KEYS,
  );

  if (
    (status !== "deleted" && status !== "already_completed") ||
    typeof contentId !== "string" ||
    typeof operationId !== "string" ||
    typeof deletedAt !== "string" ||
    typeof deletedBy !== "string" ||
    !mappedImpactCounts ||
    !mappedTombstoneResult
  ) {
    throw new ContentMutationError("repository_failure", "deleteArchivedContent");
  }

  return {
    status,
    contentId,
    operationId,
    deletedAt,
    deletedBy,
    impactCounts: mappedImpactCounts,
    tombstoneResult: mappedTombstoneResult,
  };
}

export function createDeletionRepository(
  client: DeletionRepositoryClient,
): DeletionRepository {
  return {
    async previewDeletionImpact(
      input: PreviewDeletionImpactInput,
    ): Promise<DeletionImpactPreview> {
      const result = await client.rpc("preview_archived_content_deletion", {
        p_content_id: input.contentId,
      });

      if (result.error) {
        throw mapContentMutationDatabaseError(
          result.error,
          "previewDeletionImpact",
        );
      }

      return mapImpactPreview(result.data);
    },

    async deleteArchivedContent(
      input: DeleteArchivedContentInput,
    ): Promise<DeletionReceipt> {
      const result = await client.rpc("delete_archived_content", {
        p_content_id: input.contentId,
        p_expected_archived_token: input.expectedArchivedToken,
        p_impact_digest: input.impactDigest,
        p_operation_id: input.operationId,
      });

      if (result.error) {
        throw mapContentMutationDatabaseError(
          result.error,
          "deleteArchivedContent",
        );
      }

      return mapDeletionReceipt(result.data);
    },
  };
}
