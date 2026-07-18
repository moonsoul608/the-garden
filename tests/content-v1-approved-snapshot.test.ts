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

test("unresolved blockers prevent snapshot approval", () => {
  const preview = buildV1MigrationPreview({ environment: "preview" });
  const snapshot = buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput: null,
    createdAt: CREATED_AT,
  });

  assert.equal(snapshot.approvalStatus, "Blocked");
  assert.ok(
    snapshot.blockers.some((blocker) => blocker.code === "unresolved_blockers"),
  );
  assert.ok(
    snapshot.blockers.some(
      (blocker) => blocker.code === "growth_stages_unresolved",
    ),
  );
  assert.match(formatV1ApprovedMigrationSnapshot(snapshot), /Status:\s+BLOCKED/);
  assert.throws(
    () => parseV1ApprovedMigrationSnapshot(snapshot),
    (error: unknown) =>
      error instanceof V1ApprovedMigrationSnapshotError &&
      error.code === "snapshot_not_approved",
  );
});

test("a valid complete snapshot becomes approved and freezes import inputs", () => {
  const { preview, snapshot } = approvedFixture();

  assert.equal(snapshot.approvalStatus, "Approved");
  assert.equal(snapshot.records.length, 19);
  assert.equal(snapshot.source.recordCount, 19);
  assert.equal(snapshot.relations.length, 4);
  assert.equal(snapshot.warnings.length, 4);
  assert.equal(snapshot.resolution.growthStages.length, 5);
  assert.equal(snapshot.digests.previewDigest, preview.previewDigest);
  assert.equal(
    snapshot.digests.resolutionDigest,
    preview.resolutionReport.resolutionDigest,
  );
  assert.match(snapshot.digests.snapshotDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(validateV1ApprovedMigrationSnapshot(snapshot, preview), {
    valid: true,
  });
  assert.match(formatV1ApprovedMigrationSnapshot(snapshot), /Status:\s+READY/);
  assert.match(
    formatV1ApprovedMigrationSnapshot(snapshot),
    /Record count: 19[\s\S]+Resolved records: 5/,
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

test("stale content, resolution, and preview state invalidate approval", () => {
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

  const changedResolution = structuredClone(resolutionInput);
  changedResolution.growthStages[0].notes = "Changed approval reason.";
  const changedResolutionPreview = buildV1MigrationPreview({
    environment: "preview",
    resolutionInput: changedResolution,
  });
  assert.deepEqual(
    validateV1ApprovedMigrationSnapshot(snapshot, changedResolutionPreview),
    { valid: false, reason: "resolution_state_changed" },
  );

  const staleCandidate = structuredClone(changedResolutionPreview);
  staleCandidate.previewDigest = snapshot.digests.previewDigest;
  const blocked = buildV1ApprovedMigrationSnapshot({
    preview: staleCandidate,
    resolutionInput: changedResolution,
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
