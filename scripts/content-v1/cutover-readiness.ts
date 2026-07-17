export type CutoverCheckCategory =
  | "data"
  | "application"
  | "operational"
  | "safety";

export type CutoverVerificationStatus = "PASS" | "WARNING" | "FAIL";
export type CutoverCheckStatus = "PASS" | "BLOCKED";
export type ContentSourceMode = "legacy" | "dual" | "database";

export const CUTOVER_CHECK_DEFINITIONS = [
  {
    id: "approved_preview_exists",
    category: "data",
    label: "Approved preview exists",
  },
  {
    id: "import_completed",
    category: "data",
    label: "Import completed",
  },
  {
    id: "verification_passed",
    category: "data",
    label: "Migration verification passed",
  },
  { id: "counts_match", category: "data", label: "Counts match" },
  { id: "slugs_verified", category: "data", label: "Slugs verified" },
  {
    id: "relations_verified",
    category: "data",
    label: "Relations verified",
  },
  {
    id: "versions_verified",
    category: "data",
    label: "Versions verified",
  },
  {
    id: "database_source_mode_available",
    category: "application",
    label: "Database source mode is available",
  },
  {
    id: "public_resolver_compatible",
    category: "application",
    label: "Public resolver is compatible",
  },
  {
    id: "cache_invalidation_ready",
    category: "application",
    label: "Cache invalidation is ready",
  },
  {
    id: "rollback_possible",
    category: "application",
    label: "Source-mode rollback is possible",
  },
  {
    id: "backup_confirmed",
    category: "operational",
    label: "Backup is confirmed",
  },
  {
    id: "monitoring_available",
    category: "operational",
    label: "Monitoring is available",
  },
  {
    id: "failure_recovery_documented",
    category: "operational",
    label: "Failure recovery is documented",
  },
  {
    id: "redirects_verified",
    category: "safety",
    label: "Redirect behavior is verified",
  },
  {
    id: "archived_behavior_verified",
    category: "safety",
    label: "Archived behavior is verified",
  },
  {
    id: "public_read_compatibility_verified",
    category: "safety",
    label: "Public-read compatibility is verified",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  category: CutoverCheckCategory;
  label: string;
}>;

export type CutoverCheckId =
  (typeof CUTOVER_CHECK_DEFINITIONS)[number]["id"];

export type CutoverReadinessEvidence = {
  approvedPreviewExists: boolean;
  importCompleted: boolean;
  verificationStatus: CutoverVerificationStatus;
  verificationWarningsAccepted: boolean;
  countsMatch: boolean;
  slugsVerified: boolean;
  relationsVerified: boolean;
  versionsVerified: boolean;
  databaseSourceModeAvailable: boolean;
  publicResolverCompatible: boolean;
  cacheInvalidationReady: boolean;
  rollbackPossible: boolean;
  backupConfirmed: boolean;
  monitoringAvailable: boolean;
  failureRecoveryDocumented: boolean;
  redirectsVerified: boolean;
  archivedBehaviorVerified: boolean;
  publicReadCompatibilityVerified: boolean;
};

export type CutoverReadinessCheck =
  (typeof CUTOVER_CHECK_DEFINITIONS)[number] & {
    status: CutoverCheckStatus;
    message: string;
  };

export type CutoverReadinessResult = {
  schemaVersion: 1;
  kind: "v1-cutover-readiness";
  status: "READY" | "BLOCKED";
  cutoverAllowed: boolean;
  checks: CutoverReadinessCheck[];
  blockingCheckIds: CutoverCheckId[];
};

function checkPassed(
  id: CutoverCheckId,
  evidence: CutoverReadinessEvidence,
): boolean {
  switch (id) {
    case "approved_preview_exists":
      return evidence.approvedPreviewExists;
    case "import_completed":
      return evidence.importCompleted;
    case "verification_passed":
      return (
        evidence.verificationStatus === "PASS" ||
        (evidence.verificationStatus === "WARNING" &&
          evidence.verificationWarningsAccepted)
      );
    case "counts_match":
      return evidence.countsMatch;
    case "slugs_verified":
      return evidence.slugsVerified;
    case "relations_verified":
      return evidence.relationsVerified;
    case "versions_verified":
      return evidence.versionsVerified;
    case "database_source_mode_available":
      return evidence.databaseSourceModeAvailable;
    case "public_resolver_compatible":
      return evidence.publicResolverCompatible;
    case "cache_invalidation_ready":
      return evidence.cacheInvalidationReady;
    case "rollback_possible":
      return evidence.rollbackPossible;
    case "backup_confirmed":
      return evidence.backupConfirmed;
    case "monitoring_available":
      return evidence.monitoringAvailable;
    case "failure_recovery_documented":
      return evidence.failureRecoveryDocumented;
    case "redirects_verified":
      return evidence.redirectsVerified;
    case "archived_behavior_verified":
      return evidence.archivedBehaviorVerified;
    case "public_read_compatibility_verified":
      return evidence.publicReadCompatibilityVerified;
  }
}

export function evaluateCutoverReadiness(
  evidence: CutoverReadinessEvidence,
): CutoverReadinessResult {
  const checks: CutoverReadinessCheck[] = CUTOVER_CHECK_DEFINITIONS.map(
    (definition) => {
      const passed = checkPassed(definition.id, evidence);
      return {
        ...definition,
        status: passed ? "PASS" : "BLOCKED",
        message: passed
          ? `${definition.label}: evidence accepted.`
          : `${definition.label}: required evidence is missing or not accepted.`,
      };
    },
  );
  const blockingCheckIds = checks
    .filter((check) => check.status === "BLOCKED")
    .map((check) => check.id);
  const cutoverAllowed = blockingCheckIds.length === 0;

  return {
    schemaVersion: 1,
    kind: "v1-cutover-readiness",
    status: cutoverAllowed ? "READY" : "BLOCKED",
    cutoverAllowed,
    checks,
    blockingCheckIds,
  };
}

export const SOURCE_MODE_TRANSITION_RULES = [
  {
    from: "legacy",
    to: "dual",
    prerequisites: [
      "Every cutover readiness check passes.",
      "The operator has approved the cutover window.",
    ],
    risks: [
      "Database and legacy results can diverge or be duplicated.",
      "Home curation has no legacy fallback in the current dual-mode resolver.",
      "Archived or private content could be exposed by an invalid fallback decision.",
    ],
    rollbackConditions: [
      "Any rollback condition is observed.",
      "The readiness evidence becomes invalid before the mode change.",
    ],
  },
  {
    from: "dual",
    to: "database",
    prerequisites: [
      "Every cutover readiness check still passes.",
      "The accepted stability period is complete.",
      "Fallback use is zero.",
      "Monitoring is healthy.",
      "Database parity has been reverified.",
      "Explicit final approval is recorded.",
    ],
    risks: [
      "Unmigrated content no longer has a legacy fallback.",
      "Database or cache failure can affect every public read.",
    ],
    rollbackConditions: [
      "Any rollback condition is observed.",
      "Fallback demand or a parity mismatch is discovered.",
    ],
  },
] as const;

export type SourceModeTransitionEvidence = {
  readiness: CutoverReadinessResult;
  cutoverWindowApproved: boolean;
  stabilityPeriodComplete: boolean;
  fallbackUseZero: boolean;
  monitoringHealthy: boolean;
  databaseParityReverified: boolean;
  explicitFinalApproval: boolean;
};

export type SourceModeTransitionResult = {
  from: ContentSourceMode;
  to: ContentSourceMode;
  allowed: boolean;
  blockingReasons: string[];
};

export function evaluateSourceModeTransition(
  from: ContentSourceMode,
  to: ContentSourceMode,
  evidence: SourceModeTransitionEvidence,
): SourceModeTransitionResult {
  const reasons: string[] = [];
  const supported = SOURCE_MODE_TRANSITION_RULES.some(
    (rule) => rule.from === from && rule.to === to,
  );
  if (!supported) {
    reasons.push("Only legacy-to-dual and dual-to-database forward transitions are allowed.");
  }
  if (!evidence.readiness.cutoverAllowed) {
    reasons.push("The cutover readiness checklist is blocked.");
  }
  if (from === "legacy" && to === "dual" && !evidence.cutoverWindowApproved) {
    reasons.push("The cutover window is not approved.");
  }
  if (from === "dual" && to === "database") {
    if (!evidence.stabilityPeriodComplete) {
      reasons.push("The accepted dual-mode stability period is incomplete.");
    }
    if (!evidence.fallbackUseZero) {
      reasons.push("Legacy fallback use is not zero.");
    }
    if (!evidence.monitoringHealthy) {
      reasons.push("Monitoring is not healthy.");
    }
    if (!evidence.databaseParityReverified) {
      reasons.push("Database parity has not been reverified.");
    }
    if (!evidence.explicitFinalApproval) {
      reasons.push("Explicit final approval is missing.");
    }
  }

  return { from, to, allowed: reasons.length === 0, blockingReasons: reasons };
}

export const ROLLBACK_CONDITIONS = [
  {
    id: "verification_regression",
    action: "Restore legacy source mode and preserve V2 data for diagnosis.",
  },
  {
    id: "public_read_failure",
    action: "Restore legacy source mode and investigate public read errors.",
  },
  {
    id: "redirect_or_404_regression",
    action: "Restore legacy source mode and verify route and redirect coverage.",
  },
  {
    id: "duplicate_or_discovery_mismatch",
    action: "Restore legacy source mode and compare collection projections.",
  },
  {
    id: "private_or_archived_exposure",
    action: "Restore legacy source mode immediately and disable V2 reads.",
  },
  {
    id: "database_unavailable",
    action: "Restore legacy source mode and retain the database snapshot.",
  },
  {
    id: "cache_incoherence",
    action: "Restore legacy source mode and invalidate public caches.",
  },
  {
    id: "operator_decision",
    action: "Restore legacy source mode at the incident operator's direction.",
  },
] as const;

export type RollbackConditionId = (typeof ROLLBACK_CONDITIONS)[number]["id"];

export function evaluateRollbackConditions(
  observed: ReadonlyArray<RollbackConditionId>,
) {
  const observedSet = new Set(observed);
  const triggered = ROLLBACK_CONDITIONS.filter((condition) =>
    observedSet.has(condition.id),
  );
  return {
    rollbackRequired: triggered.length > 0,
    restoreSourceMode: triggered.length > 0 ? ("legacy" as const) : null,
    preserveV2Data: true as const,
    preserveV1Fallback: true as const,
    invalidateCaches: triggered.length > 0,
    triggered,
  };
}
