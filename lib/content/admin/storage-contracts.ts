import "server-only";

export const ORDINARY_REPLACEMENT_QUARANTINE_DAYS = 30 as const;

export type StorageObjectIdentity = Readonly<{
  bucket: string;
  objectPath: string;
}>;

export type StorageReferenceOwnerType =
  | "ContentProjection"
  | "ContentRevision"
  | "ContentVersion";

export type StorageReferenceState = "Referenced";

export type StorageObjectLifecycleState =
  | "Referenced"
  | "Unreferenced"
  | "Quarantine"
  | "EligibleForPurge";

export type StorageQuarantineReason =
  | "OrdinaryReplacement"
  | "FailedUpload"
  | "PermanentContentDeletion";

export type StorageReferenceRecord = StorageObjectIdentity &
  Readonly<{
    referenceOwnerType: StorageReferenceOwnerType;
    referenceOwnerId: string;
    contentId: string | null;
    referenceState: StorageReferenceState;
    createdAt: string;
    updatedAt: string;
  }>;

/**
 * Future non-database mutations use this shape at their repository boundary.
 * Current content projection, revision, and version writes are synchronized
 * by database triggers in the same transaction as their owner mutation.
 */
export type ReplaceStorageOwnerReferencesInput = Readonly<{
  ownerType: StorageReferenceOwnerType;
  ownerId: string;
  contentId: string | null;
  references: readonly StorageObjectIdentity[];
  mutationBoundary:
    | "publish"
    | "draftChange"
    | "restore"
    | "archiveCheckpoint"
    | "permanentDelete"
    | "reconciliationRepair";
}>;

export type StoragePurgeBlockingReason =
  | "tracked_reference_present"
  | "projection_reference_present"
  | "active_revision_reference_present"
  | "version_reference_present"
  | "lifecycle_record_missing"
  | "object_not_quarantined"
  | "quarantine_evidence_missing"
  | "quarantine_not_elapsed"
  | "safety_evidence_unavailable";

export type StoragePurgeSafetyEvidence = StorageObjectIdentity &
  Readonly<{
    checkedAt: string;
    trackedReferenceCount: number | null;
    projectionReferenceCount: number | null;
    activeRevisionReferenceCount: number | null;
    versionReferenceCount: number | null;
    lifecycleState: StorageObjectLifecycleState | null;
    quarantineReason: StorageQuarantineReason | null;
    quarantineStartedAt: string | null;
    quarantineUntil: string | null;
  }>;

export type StoragePurgeSafetyDecision = StoragePurgeSafetyEvidence &
  Readonly<{
    eligible: boolean;
    blockingReasons: readonly StoragePurgeBlockingReason[];
  }>;

export type FailedUploadQuarantineInput = StorageObjectIdentity &
  Readonly<{
    /** A separate upload-owned grace period; ordinary replacement stays 30 days. */
    gracePeriodSeconds: number;
  }>;

export type StorageQuarantineReceipt = StorageObjectIdentity &
  Readonly<{
    lifecycleState: "Quarantine" | "EligibleForPurge";
    quarantineReason: "FailedUpload" | "PermanentContentDeletion";
    quarantineUntil: string;
  }>;

/**
 * Server-only foundation. It can inspect or mark lifecycle state, but it has
 * no method capable of deleting a physical Storage object.
 */
export interface StorageReferenceRepository {
  inspectPurgeSafety(
    identity: StorageObjectIdentity,
  ): Promise<StoragePurgeSafetyDecision>;
  quarantineFailedUpload(
    input: FailedUploadQuarantineInput,
  ): Promise<StorageQuarantineReceipt>;
  markPermanentDeletionCommitted(
    identity: StorageObjectIdentity,
  ): Promise<StorageQuarantineReceipt>;
}

export type StorageReconciliationState =
  | "referenced"
  | "missing_object"
  | "orphaned_object"
  | "purge_candidate";

export type StorageReconciliationObservation = StorageObjectIdentity &
  Readonly<{
    physicalObjectExists: boolean;
    trackedReferenceCount: number;
    authoritativeReferenceCount: number;
    purgeSafety: StoragePurgeSafetyDecision | null;
  }>;

export type StorageReconciliationResult = StorageReconciliationObservation &
  Readonly<{
    state: StorageReconciliationState;
  }>;

/** Contract only; a scanner/worker is intentionally outside this phase. */
export interface StorageReferenceRepairScanner {
  reconcile(
    observations: AsyncIterable<StorageReconciliationObservation>,
  ): AsyncIterable<StorageReconciliationResult>;
}
