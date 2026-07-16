import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import type {
  FailedUploadQuarantineInput,
  StorageObjectIdentity,
  StorageObjectLifecycleState,
  StoragePurgeSafetyDecision,
  StoragePurgeSafetyEvidence,
  StorageQuarantineReason,
  StorageQuarantineReceipt,
  StorageReferenceRepository,
} from "./storage-contracts";
import { evaluateStoragePurgeSafety } from "./storage-purge-safety";

type JsonObject = { [key: string]: Json | undefined };

const LIFECYCLE_STATES = new Set<StorageObjectLifecycleState>([
  "Referenced",
  "Unreferenced",
  "Quarantine",
  "EligibleForPurge",
]);
const QUARANTINE_REASONS = new Set<StorageQuarantineReason>([
  "OrdinaryReplacement",
  "FailedUpload",
  "PermanentContentDeletion",
]);

function isObject(value: Json | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: Json | undefined): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableString(value: Json | undefined): value is string | null {
  return value === null || typeof value === "string";
}

export class StorageReferenceRepositoryError extends Error {
  readonly code = "storage_reference_repository_unavailable";

  constructor() {
    super("Storage reference safety evidence is unavailable.");
    this.name = "StorageReferenceRepositoryError";
  }
}

function mapPurgeEvidence(value: Json): StoragePurgeSafetyDecision {
  if (!isObject(value)) throw new StorageReferenceRepositoryError();

  const {
    bucket,
    objectPath,
    checkedAt,
    trackedReferenceCount,
    projectionReferenceCount,
    activeRevisionReferenceCount,
    versionReferenceCount,
    lifecycleState,
    quarantineReason,
    quarantineStartedAt,
    quarantineUntil,
  } = value;

  if (
    typeof bucket !== "string" ||
    typeof objectPath !== "string" ||
    typeof checkedAt !== "string" ||
    !isCount(trackedReferenceCount) ||
    !isCount(projectionReferenceCount) ||
    !isCount(activeRevisionReferenceCount) ||
    !isCount(versionReferenceCount) ||
    (lifecycleState !== null &&
      (typeof lifecycleState !== "string" ||
        !LIFECYCLE_STATES.has(lifecycleState as StorageObjectLifecycleState))) ||
    (quarantineReason !== null &&
      (typeof quarantineReason !== "string" ||
        !QUARANTINE_REASONS.has(quarantineReason as StorageQuarantineReason))) ||
    !isNullableString(quarantineStartedAt) ||
    !isNullableString(quarantineUntil)
  ) {
    throw new StorageReferenceRepositoryError();
  }

  const evidence: StoragePurgeSafetyEvidence = {
    bucket,
    objectPath,
    checkedAt,
    trackedReferenceCount,
    projectionReferenceCount,
    activeRevisionReferenceCount,
    versionReferenceCount,
    lifecycleState: lifecycleState as StorageObjectLifecycleState | null,
    quarantineReason: quarantineReason as StorageQuarantineReason | null,
    quarantineStartedAt,
    quarantineUntil,
  };

  return evaluateStoragePurgeSafety(evidence);
}

function mapQuarantineReceipt(value: Json): StorageQuarantineReceipt {
  if (!isObject(value)) throw new StorageReferenceRepositoryError();
  const {
    bucket,
    objectPath,
    lifecycleState,
    quarantineReason,
    quarantineUntil,
  } = value;

  if (
    typeof bucket !== "string" ||
    typeof objectPath !== "string" ||
    (lifecycleState !== "Quarantine" &&
      lifecycleState !== "EligibleForPurge") ||
    (quarantineReason !== "FailedUpload" &&
      quarantineReason !== "PermanentContentDeletion") ||
    typeof quarantineUntil !== "string" ||
    !Number.isFinite(Date.parse(quarantineUntil))
  ) {
    throw new StorageReferenceRepositoryError();
  }

  return {
    bucket,
    objectPath,
    lifecycleState,
    quarantineReason,
    quarantineUntil,
  };
}

export type StorageReferenceRepositoryClient = SupabaseClient<ContentDatabase>;

/**
 * The injected client must be created in a server-only service-role boundary.
 * Database grants reject these RPCs for anon and authenticated browser roles.
 */
export function createStorageReferenceRepository(
  client: StorageReferenceRepositoryClient,
): StorageReferenceRepository {
  async function inspectPurgeSafety(
    identity: StorageObjectIdentity,
  ): Promise<StoragePurgeSafetyDecision> {
    const result = await client.rpc("inspect_storage_object_purge_safety", {
      p_bucket: identity.bucket,
      p_object_path: identity.objectPath,
    });
    if (result.error) throw new StorageReferenceRepositoryError();
    return mapPurgeEvidence(result.data);
  }

  async function quarantineFailedUpload(
    input: FailedUploadQuarantineInput,
  ): Promise<StorageQuarantineReceipt> {
    if (
      !Number.isSafeInteger(input.gracePeriodSeconds) ||
      input.gracePeriodSeconds <= 0
    ) {
      throw new StorageReferenceRepositoryError();
    }

    const result = await client.rpc("quarantine_failed_storage_upload", {
      p_bucket: input.bucket,
      p_object_path: input.objectPath,
      p_grace_period: `${input.gracePeriodSeconds} seconds`,
    });
    if (result.error) throw new StorageReferenceRepositoryError();
    return mapQuarantineReceipt(result.data);
  }

  async function markPermanentDeletionCommitted(
    identity: StorageObjectIdentity,
  ): Promise<StorageQuarantineReceipt> {
    const result = await client.rpc("mark_storage_object_post_delete_bypass", {
      p_bucket: identity.bucket,
      p_object_path: identity.objectPath,
    });
    if (result.error) throw new StorageReferenceRepositoryError();
    return mapQuarantineReceipt(result.data);
  }

  return {
    inspectPurgeSafety,
    quarantineFailedUpload,
    markPermanentDeletionCommitted,
  };
}
