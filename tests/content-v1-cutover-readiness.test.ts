import assert from "node:assert/strict";
import test from "node:test";

import {
  CUTOVER_CHECK_DEFINITIONS,
  evaluateCutoverReadiness,
  evaluateRollbackConditions,
  evaluateSourceModeTransition,
  ROLLBACK_CONDITIONS,
  SOURCE_MODE_TRANSITION_RULES,
  type CutoverReadinessEvidence,
  type SourceModeTransitionEvidence,
} from "../scripts/content-v1/cutover-readiness.ts";

function passingEvidence(): CutoverReadinessEvidence {
  return {
    approvedPreviewExists: true,
    importCompleted: true,
    verificationStatus: "PASS",
    verificationWarningsAccepted: false,
    countsMatch: true,
    slugsVerified: true,
    relationsVerified: true,
    versionsVerified: true,
    databaseSourceModeAvailable: true,
    publicResolverCompatible: true,
    cacheInvalidationReady: true,
    rollbackPossible: true,
    backupConfirmed: true,
    monitoringAvailable: true,
    failureRecoveryDocumented: true,
    redirectsVerified: true,
    archivedBehaviorVerified: true,
    publicReadCompatibilityVerified: true,
  };
}

function transitionEvidence(
  overrides: Partial<SourceModeTransitionEvidence> = {},
): SourceModeTransitionEvidence {
  return {
    readiness: evaluateCutoverReadiness(passingEvidence()),
    cutoverWindowApproved: true,
    stabilityPeriodComplete: true,
    fallbackUseZero: true,
    monitoringHealthy: true,
    databaseParityReverified: true,
    explicitFinalApproval: true,
    ...overrides,
  };
}

test("cutover checklist contains every required data, application, operational, and safety gate", () => {
  assert.deepEqual(
    CUTOVER_CHECK_DEFINITIONS.map(({ id }) => id),
    [
      "approved_preview_exists",
      "import_completed",
      "verification_passed",
      "counts_match",
      "slugs_verified",
      "relations_verified",
      "versions_verified",
      "database_source_mode_available",
      "public_resolver_compatible",
      "cache_invalidation_ready",
      "rollback_possible",
      "backup_confirmed",
      "monitoring_available",
      "failure_recovery_documented",
      "redirects_verified",
      "archived_behavior_verified",
      "public_read_compatibility_verified",
    ],
  );
  assert.deepEqual(
    [...new Set(CUTOVER_CHECK_DEFINITIONS.map(({ category }) => category))],
    ["data", "application", "operational", "safety"],
  );
});

test("cutover is blocked when migration verification fails", () => {
  const evidence = passingEvidence();
  evidence.verificationStatus = "FAIL";
  evidence.verificationWarningsAccepted = true;
  const result = evaluateCutoverReadiness(evidence);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.cutoverAllowed, false);
  assert.deepEqual(result.blockingCheckIds, ["verification_passed"]);
});

test("verification warnings require an explicit acceptance", () => {
  const evidence = passingEvidence();
  evidence.verificationStatus = "WARNING";
  assert.equal(evaluateCutoverReadiness(evidence).cutoverAllowed, false);

  evidence.verificationWarningsAccepted = true;
  assert.equal(evaluateCutoverReadiness(evidence).cutoverAllowed, true);
});

test("source modes can advance only from legacy to dual to database", () => {
  assert.deepEqual(
    SOURCE_MODE_TRANSITION_RULES.map(({ from, to }) => `${from}->${to}`),
    ["legacy->dual", "dual->database"],
  );
  assert.equal(
    evaluateSourceModeTransition(
      "legacy",
      "database",
      transitionEvidence(),
    ).allowed,
    false,
  );
  assert.equal(
    evaluateSourceModeTransition("legacy", "dual", transitionEvidence())
      .allowed,
    true,
  );
  assert.equal(
    evaluateSourceModeTransition("dual", "database", transitionEvidence())
      .allowed,
    true,
  );
});

test("database-only mode is blocked until dual-mode exit evidence is complete", () => {
  const result = evaluateSourceModeTransition(
    "dual",
    "database",
    transitionEvidence({ fallbackUseZero: false }),
  );
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockingReasons, ["Legacy fallback use is not zero."]);
});

test("rollback conditions deterministically require legacy mode, V2 preservation, and cache invalidation", () => {
  assert.deepEqual(
    ROLLBACK_CONDITIONS.map(({ id }) => id),
    [
      "verification_regression",
      "public_read_failure",
      "redirect_or_404_regression",
      "duplicate_or_discovery_mismatch",
      "private_or_archived_exposure",
      "database_unavailable",
      "cache_incoherence",
      "operator_decision",
    ],
  );
  const result = evaluateRollbackConditions([
    "cache_incoherence",
    "public_read_failure",
  ]);
  assert.equal(result.rollbackRequired, true);
  assert.equal(result.restoreSourceMode, "legacy");
  assert.equal(result.preserveV2Data, true);
  assert.equal(result.preserveV1Fallback, true);
  assert.equal(result.invalidateCaches, true);
  assert.deepEqual(
    result.triggered.map(({ id }) => id),
    ["public_read_failure", "cache_incoherence"],
  );
});
