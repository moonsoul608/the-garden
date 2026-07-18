import assert from "node:assert/strict";
import test from "node:test";

import {
  buildV1ApprovedMigrationSnapshot,
  calculateV1ApprovedMigrationSnapshotDigest,
  formatV1ApprovedMigrationSnapshot,
  parseV1ApprovedMigrationSnapshot,
  serializeV1ApprovedMigrationSnapshot,
  validateV1ApprovedMigrationSnapshot,
  V1ApprovedMigrationSnapshotError,
} from "../scripts/content-v1/approved-snapshot.ts";
import { extractV1Content } from "../scripts/content-v1/extract.ts";
import { buildV1MigrationPreview } from "../scripts/content-v1/preview.ts";
import { V1_GROWTH_STAGE_BLOCKER_IDS } from "../scripts/content-v1/resolutions.ts";
import { V1_MIGRATION_VALIDATION_POLICY } from "../scripts/content-v1/validation-policy.ts";
import type { V1MigrationResolutionInput } from "../types/content.ts";

const CREATED_AT = "2026-07-18T08:00:00.000Z";

function resolvedInput(): V1MigrationResolutionInput {
  return {
    schemaVersion: 1,
    kind: "v1-migration-resolution-input",
    growthStages: V1_GROWTH_STAGE_BLOCKER_IDS.map((legacyId) => ({
      source: "v1-static-typescript",
      legacyId,
      route: `/lake/${legacyId}`,
      growthStage: "Seed",
      decisionMethod: "manual",
      resolutionSource: "08B test fixture",
      approvedBy: "test-garden-keeper",
      approvedAt: "2026-07-18T07:00:00.000Z",
      approvalStatus: "Approved",
      notes: "Test-only approval; not an editorial decision.",
    })),
  };
}

function approvedFixture() {
  const resolutionInput = resolvedInput();
  const preview = buildV1MigrationPreview({
    environment: "preview",
    resolutionInput,
  });
  const snapshot = buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput,
    createdAt: CREATED_AT,
  });
  return { resolutionInput, preview, snapshot };
}

test("Lake null Growth Stages allow snapshot approval without resolutions", () => {
  const preview = buildV1MigrationPreview({ environment: "preview" });
  const snapshot = buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput: null,
    createdAt: CREATED_AT,
  });

  assert.equal(snapshot.approvalStatus, "Approved");
  assert.deepEqual(snapshot.blockers, []);
  assert.deepEqual(snapshot.resolution.growthStages, []);
  assert.equal(
    snapshot.records.filter((record) => record.sourceRecord.region === "Lake").length,
    5,
  );
  assert.ok(
    snapshot.records
      .filter((record) => record.sourceRecord.region === "Lake")
      .every((record) => record.sourceRecord.growthStage === null),
  );
  assert.match(formatV1ApprovedMigrationSnapshot(snapshot), /Status:\s+READY/);
  assert.equal(parseV1ApprovedMigrationSnapshot(snapshot).records.length, 19);
});

test("a valid complete snapshot becomes approved and freezes import inputs", () => {
  const { preview, snapshot } = approvedFixture();

  assert.equal(snapshot.approvalStatus, "Approved");
  assert.equal(snapshot.records.length, 19);
  assert.equal(snapshot.source.recordCount, 19);
  assert.equal(snapshot.relations.length, 4);
  assert.equal(snapshot.warnings.length, 4);
  assert.equal(snapshot.resolution.growthStages.length, 0);
  assert.equal(snapshot.snapshotVersion, 2);
  assert.equal(snapshot.metadata.migrationTask, "08B-1");
  assert.deepEqual(snapshot.metadata.nullableLakeGrowthStage, {
    recordCount: 5,
    meaning: "not growth-tracked / not applicable",
    resolutionRequired: false,
  });
  assert.equal(
    snapshot.validationPolicy.version,
    "v1-migration-validation-08b1",
  );
  assert.ok(Object.values(snapshot.checks).every(Boolean));
  assert.equal(snapshot.digests.previewDigest, preview.previewDigest);
  assert.equal(
    snapshot.digests.resolutionDigest,
    preview.resolutionReport.resolutionDigest,
  );
  assert.match(snapshot.digests.snapshotDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(snapshot.digests.schemaDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(validateV1ApprovedMigrationSnapshot(snapshot, preview), {
    valid: true,
  });
  assert.match(formatV1ApprovedMigrationSnapshot(snapshot), /Status:\s+READY/);
  assert.match(
    formatV1ApprovedMigrationSnapshot(snapshot),
    /Record count: 19[\s\S]+Resolved records: 0/,
  );
});

test("old snapshot is rejected after validation or applicability policy changes", () => {
  const { snapshot } = approvedFixture();
  const oldPolicy = structuredClone(snapshot);
  oldPolicy.validationPolicy.version = "v1-migration-validation-08b";
  oldPolicy.digests.schemaDigest = `sha256:${"1".repeat(64)}`;
  oldPolicy.digests.snapshotDigest =
    calculateV1ApprovedMigrationSnapshotDigest(oldPolicy);

  assert.throws(
    () => parseV1ApprovedMigrationSnapshot(oldPolicy),
    (error: unknown) =>
      error instanceof V1ApprovedMigrationSnapshotError &&
      error.code === "validation_policy_mismatch",
  );

  const changedApplicability = structuredClone(snapshot);
  changedApplicability.validationPolicy.growthStageApplicability.optional = [];
  changedApplicability.digests.snapshotDigest =
    calculateV1ApprovedMigrationSnapshotDigest(changedApplicability);
  assert.throws(
    () => parseV1ApprovedMigrationSnapshot(changedApplicability),
    (error: unknown) =>
      error instanceof V1ApprovedMigrationSnapshotError &&
      error.code === "validation_policy_mismatch",
  );

  assert.equal(
    snapshot.validationPolicy.growthStageApplicability.policyId,
    V1_MIGRATION_VALIDATION_POLICY.growthStageApplicability.policyId,
  );
});

test("digest mismatch and incomplete records are rejected", () => {
  const { snapshot } = approvedFixture();
  const digestMismatch = structuredClone(snapshot);
  digestMismatch.digests.snapshotDigest = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => parseV1ApprovedMigrationSnapshot(digestMismatch),
    (error: unknown) =>
      error instanceof V1ApprovedMigrationSnapshotError &&
      error.code === "snapshot_digest_mismatch",
  );

  const incomplete = structuredClone(snapshot);
  incomplete.records.pop();
  incomplete.digests.snapshotDigest =
    calculateV1ApprovedMigrationSnapshotDigest(incomplete);
  assert.throws(
    () => parseV1ApprovedMigrationSnapshot(incomplete),
    (error: unknown) =>
      error instanceof V1ApprovedMigrationSnapshotError &&
      error.code === "snapshot_records_incomplete",
  );
});

test("stale content and preview state invalidate approval", () => {
  const { resolutionInput, snapshot } = approvedFixture();
  const changedExtract = extractV1Content();
  changedExtract.garden[0].summary = `${changedExtract.garden[0].summary} changed`;
  const changedSourcePreview = buildV1MigrationPreview({
    environment: "preview",
    extract: changedExtract,
    resolutionInput,
  });
  assert.deepEqual(
    validateV1ApprovedMigrationSnapshot(snapshot, changedSourcePreview),
    { valid: false, reason: "source_state_changed" },
  );

  const staleCandidate = structuredClone(changedSourcePreview);
  staleCandidate.previewDigest = snapshot.digests.previewDigest;
  const blocked = buildV1ApprovedMigrationSnapshot({
    preview: staleCandidate,
    resolutionInput,
    extract: changedExtract,
    createdAt: CREATED_AT,
  });
  assert.equal(blocked.approvalStatus, "Blocked");
  assert.ok(
    blocked.blockers.some(
      (blocker) => blocker.code === "preview_digest_mismatch",
    ),
  );
});

test("approved snapshot output is deterministic for explicit approval time", () => {
  const resolutionInput = resolvedInput();
  const preview = buildV1MigrationPreview({
    environment: "preview",
    resolutionInput,
  });
  const first = buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput,
    createdAt: CREATED_AT,
  });
  const second = buildV1ApprovedMigrationSnapshot({
    preview: structuredClone(preview),
    resolutionInput: {
      ...resolutionInput,
      growthStages: [...resolutionInput.growthStages].reverse(),
    },
    createdAt: CREATED_AT,
  });

  assert.equal(
    serializeV1ApprovedMigrationSnapshot(second),
    serializeV1ApprovedMigrationSnapshot(first),
  );
  assert.equal(
    second.digests.snapshotDigest,
    first.digests.snapshotDigest,
  );
});
