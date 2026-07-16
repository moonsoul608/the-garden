import "server-only";

import type {
  StoragePurgeBlockingReason,
  StoragePurgeSafetyDecision,
  StoragePurgeSafetyEvidence,
} from "./storage-contracts";

function isCount(value: number | null): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function hasValidDate(value: string | null): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/**
 * Recomputes eligibility from evidence instead of trusting a caller-provided
 * boolean. Missing, malformed, referenced, or not-yet-quarantined evidence is
 * always blocked.
 */
export function evaluateStoragePurgeSafety(
  evidence: StoragePurgeSafetyEvidence,
): StoragePurgeSafetyDecision {
  const blockingReasons = new Set<StoragePurgeBlockingReason>();
  const counts = [
    evidence.trackedReferenceCount,
    evidence.projectionReferenceCount,
    evidence.activeRevisionReferenceCount,
    evidence.versionReferenceCount,
  ];

  if (
    !evidence.bucket.trim() ||
    !evidence.objectPath.trim() ||
    !hasValidDate(evidence.checkedAt) ||
    counts.some((count) => !isCount(count))
  ) {
    blockingReasons.add("safety_evidence_unavailable");
  }

  if (
    isCount(evidence.trackedReferenceCount) &&
    evidence.trackedReferenceCount > 0
  ) {
    blockingReasons.add("tracked_reference_present");
  }
  if (
    isCount(evidence.projectionReferenceCount) &&
    evidence.projectionReferenceCount > 0
  ) {
    blockingReasons.add("projection_reference_present");
  }
  if (
    isCount(evidence.activeRevisionReferenceCount) &&
    evidence.activeRevisionReferenceCount > 0
  ) {
    blockingReasons.add("active_revision_reference_present");
  }
  if (
    isCount(evidence.versionReferenceCount) &&
    evidence.versionReferenceCount > 0
  ) {
    blockingReasons.add("version_reference_present");
  }

  if (evidence.lifecycleState === null) {
    blockingReasons.add("lifecycle_record_missing");
  } else if (
    evidence.lifecycleState === "Referenced" ||
    evidence.lifecycleState === "Unreferenced"
  ) {
    blockingReasons.add("object_not_quarantined");
  } else if (
    !hasValidDate(evidence.quarantineStartedAt) ||
    !hasValidDate(evidence.quarantineUntil)
  ) {
    blockingReasons.add("quarantine_evidence_missing");
  } else if (
    hasValidDate(evidence.checkedAt) &&
    Date.parse(evidence.quarantineUntil) > Date.parse(evidence.checkedAt)
  ) {
    blockingReasons.add("quarantine_not_elapsed");
  }

  return {
    ...evidence,
    eligible: blockingReasons.size === 0,
    blockingReasons: [...blockingReasons],
  };
}

export function storageObjectMayPurge(
  decision: StoragePurgeSafetyDecision,
): boolean {
  const recomputed = evaluateStoragePurgeSafety(decision);
  return (
    decision.eligible &&
    decision.blockingReasons.length === 0 &&
    recomputed.eligible
  );
}
