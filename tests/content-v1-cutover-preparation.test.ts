import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPLETED_MIGRATION_CUTOVER_CHECK_IDS,
  COMPLETED_MIGRATION_EXPECTED_COUNTS,
  CUTOVER_CACHE_SURFACES,
  CUTOVER_ROLLBACK_SOURCE_MODE_PATH,
  evaluateCompletedMigrationCutoverPreparation,
  type CompletedMigrationCutoverEvidence,
} from "../scripts/content-v1/cutover-readiness.ts";

function completedEvidence(): CompletedMigrationCutoverEvidence {
  return {
    database: {
      contentCount: 19,
      versionCount: 19,
      relationCount: 4,
      relationsIntegrityVerified: true,
      migrationReceiptExists: true,
      lakeNullGrowthStageValid: true,
    },
    sourceModes: {
      defaultMode: "legacy",
      legacyBehaviorUnchanged: true,
      dualBehaviorUnchanged: true,
      databaseBehaviorVerified: true,
      databaseFallbackReads: 0,
    },
    rollbackPath: [...CUTOVER_ROLLBACK_SOURCE_MODE_PATH],
    cacheSurfaces: [...CUTOVER_CACHE_SURFACES],
  };
}

test("completed migration evidence prepares but never executes the cutover boundary", () => {
  assert.deepEqual(COMPLETED_MIGRATION_EXPECTED_COUNTS, {
    contents: 19,
    versions: 19,
    relations: 4,
  });
  assert.deepEqual(COMPLETED_MIGRATION_CUTOVER_CHECK_IDS, [
    "content_count",
    "version_count",
    "relation_count",
    "relation_integrity",
    "migration_receipt",
    "lake_null_growth_stage",
    "legacy_default",
    "legacy_behavior",
    "dual_behavior",
    "database_behavior",
    "database_no_fallback",
    "rollback_path",
    "cache_surfaces",
  ]);

  const result = evaluateCompletedMigrationCutoverPreparation(
    completedEvidence(),
  );
  assert.equal(result.status, "PREPARED");
  assert.equal(result.cutoverExecuted, false);
  assert.deepEqual(result.blockingCheckIds, []);
  assert.ok(result.checks.every(({ status }) => status === "PASS"));
});

test("database counts, relation integrity, receipt, and Lake applicability are blocking", () => {
  const evidence = completedEvidence();
  evidence.database.contentCount = 18;
  evidence.database.versionCount = 20;
  evidence.database.relationCount = 3;
  evidence.database.relationsIntegrityVerified = false;
  evidence.database.migrationReceiptExists = false;
  evidence.database.lakeNullGrowthStageValid = false;

  assert.deepEqual(
    evaluateCompletedMigrationCutoverPreparation(evidence).blockingCheckIds,
    [
      "content_count",
      "version_count",
      "relation_count",
      "relation_integrity",
      "migration_receipt",
      "lake_null_growth_stage",
    ],
  );
});

test("source modes require the legacy default, unchanged behavior, and zero database fallback", () => {
  const evidence = completedEvidence();
  evidence.sourceModes.defaultMode = "dual";
  evidence.sourceModes.legacyBehaviorUnchanged = false;
  evidence.sourceModes.dualBehaviorUnchanged = false;
  evidence.sourceModes.databaseBehaviorVerified = false;
  evidence.sourceModes.databaseFallbackReads = 1;

  assert.deepEqual(
    evaluateCompletedMigrationCutoverPreparation(evidence).blockingCheckIds,
    [
      "legacy_default",
      "legacy_behavior",
      "dual_behavior",
      "database_behavior",
      "database_no_fallback",
    ],
  );
});

test("rollback must be database to dual to legacy and every future cache surface is required", () => {
  assert.deepEqual(CUTOVER_ROLLBACK_SOURCE_MODE_PATH, [
    "database",
    "dual",
    "legacy",
  ]);
  assert.deepEqual(CUTOVER_CACHE_SURFACES, [
    "route-cache",
    "metadata",
    "sitemap",
    "static-content",
  ]);

  for (const missingSurface of CUTOVER_CACHE_SURFACES) {
    const evidence = completedEvidence();
    evidence.cacheSurfaces = CUTOVER_CACHE_SURFACES.filter(
      (surface) => surface !== missingSurface,
    );
    assert.deepEqual(
      evaluateCompletedMigrationCutoverPreparation(evidence).blockingCheckIds,
      ["cache_surfaces"],
      missingSurface,
    );
  }

  const directRollback = completedEvidence();
  directRollback.rollbackPath = ["database", "legacy"];
  assert.deepEqual(
    evaluateCompletedMigrationCutoverPreparation(directRollback)
      .blockingCheckIds,
    ["rollback_path"],
  );
});
