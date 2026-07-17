import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildV1MigrationPreview,
  formatV1MigrationPreview,
  validateV1ApprovedPreviewSnapshot,
} from "../scripts/content-v1/preview.ts";
import { buildV1DryRunReport } from "../scripts/content-v1/apply.ts";
import { extractV1Content } from "../scripts/content-v1/extract.ts";
import {
  validateV1PublishedAtPolicy,
  V1_GROWTH_STAGE_BLOCKER_IDS,
} from "../scripts/content-v1/resolutions.ts";
import { transformV1Content } from "../scripts/content-v1/transform.ts";
import type { V1MigrationResolutionInput } from "../types/content.ts";

function testResolutionInput(
  legacyIds: readonly string[] = V1_GROWTH_STAGE_BLOCKER_IDS,
): V1MigrationResolutionInput {
  return {
    schemaVersion: 1,
    kind: "v1-migration-resolution-input",
    growthStages: legacyIds.map((legacyId) => ({
      legacyId,
      growthStage: "Seed",
      decisionMethod: "manual",
      resolutionSource: "test fixture only",
      approvedBy: "test-garden-keeper",
      approvedAt: "2026-07-17T00:00:00.000Z",
      approvalStatus: "Approved",
    })),
  };
}

test("preview output and deterministic IDs are byte-stable", () => {
  const first = buildV1MigrationPreview();
  const second = buildV1MigrationPreview();

  assert.deepEqual(second, first);
  assert.equal(first.previewDigest, second.previewDigest);
  assert.match(first.previewDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(new Set(first.records.map((record) => record.previewRecordId)).size, 19);
  assert.equal(
    new Set(first.records.map((record) => record.destinationIdentity.deterministicId)).size,
    19,
  );
});

test("blocked records include the exact field, requirement, and manual action", () => {
  const preview = buildV1MigrationPreview();
  const blocked = preview.records.filter(
    (record) => record.validationStatus === "Blocked",
  );

  assert.equal(preview.summary.ready, 14);
  assert.equal(preview.summary.blocked, 5);
  assert.equal(preview.summary.create, 14);
  assert.equal(blocked.length, 5);
  assert.equal(preview.blockers.length, 0);
  assert.equal(preview.resolutionReport.before.blocked, 5);
  assert.equal(preview.resolutionReport.after.resolved, 0);
  assert.equal(preview.resolutionReport.after.remaining, 5);
  assert.equal(preview.resolutionReport.publishedAt.outcome, "preserve-null");
  assert.equal(preview.resolutionReport.publishedAt.approvalStatus, "Approved");
  for (const record of blocked) {
    assert.equal(record.region, "Lake");
    assert.equal(record.plannedOperation, "None");
    assert.equal(record.blockers[0]?.field, "growthStage");
    assert.match(record.blockers[0]?.whyRequired ?? "", /requires/i);
    assert.match(record.blockers[0]?.manualAction ?? "", /Garden Keeper/i);
  }

  const human = formatV1MigrationPreview(preview);
  assert.match(human, /Ready:\s+14/);
  assert.match(human, /Blocked:\s+5/);
  assert.match(human, /Resolved:\s+0/);
  assert.match(human, /Remaining:\s+5/);
  assert.match(human, /Missing\/conflicting field: growthStage/);
});

test("unresolved blocker prevents approved snapshot readiness", () => {
  const preview = buildV1MigrationPreview();
  const approval = {
    schemaVersion: 1 as const,
    approved: true as const,
    previewDigest: preview.previewDigest,
    sourceDigest: preview.sourceDigest,
    destinationStateDigest: preview.destinationStateDigest,
  };

  assert.equal(preview.readiness.importReady, false);
  assert.ok(
    preview.records
      .filter((record) => record.validationStatus === "Blocked")
      .every((record) => record.importReady === false),
  );
  assert.deepEqual(validateV1ApprovedPreviewSnapshot(approval, preview), {
    valid: false,
    reason: "preview_not_import_ready",
  });
});

test("a manually approved Growth Stage resolves its record and keeps the rest pending", () => {
  const [legacyId] = V1_GROWTH_STAGE_BLOCKER_IDS;
  const preview = buildV1MigrationPreview({
    resolutionInput: testResolutionInput([legacyId]),
  });
  const resolved = preview.records.find(
    (record) => record.sourceIdentity.legacyId === legacyId,
  );

  assert.equal(resolved?.growthStage, "Seed");
  assert.equal(resolved?.growthStageResolution?.approvalStatus, "Approved");
  assert.equal(resolved?.importReady, true);
  assert.equal(preview.resolutionReport.after.resolved, 1);
  assert.equal(preview.resolutionReport.after.remaining, 4);
  assert.equal(preview.readiness.importReady, false);
});

test("publishedAt preserve-null policy accepts null and rejects unconfirmed dates", () => {
  const bundle = transformV1Content();
  assert.deepEqual(validateV1PublishedAtPolicy(bundle), []);

  const changed = structuredClone(bundle);
  changed.contents[0].publishedAt = "2026-07-17T00:00:00.000Z";
  const issues = validateV1PublishedAtPolicy(changed);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.field, "publishedAt");
  assert.match(issues[0]?.message ?? "", /derived or unconfirmed dates are forbidden/i);
});

test("approval digest changes after a Growth Stage resolution", () => {
  const pending = buildV1MigrationPreview();
  const resolved = buildV1MigrationPreview({
    resolutionInput: testResolutionInput([V1_GROWTH_STAGE_BLOCKER_IDS[0]]),
  });

  assert.notEqual(resolved.sourceDigest, pending.sourceDigest);
  assert.notEqual(resolved.previewDigest, pending.previewDigest);
  assert.notEqual(
    resolved.records.find(
      (record) =>
        record.sourceIdentity.legacyId === V1_GROWTH_STAGE_BLOCKER_IDS[0],
    )?.recordDigest,
    pending.records.find(
      (record) =>
        record.sourceIdentity.legacyId === V1_GROWTH_STAGE_BLOCKER_IDS[0],
    )?.recordDigest,
  );
});

test("compatibility warnings are preserved without becoming invented values", () => {
  const preview = buildV1MigrationPreview();

  assert.equal(preview.summary.warnings, 4);
  assert.deepEqual(
    preview.warnings.map((warning) => warning.code),
    [
      "home_curation_deferred",
      "site_copy_deferred",
      "display_overrides_deferred",
      "related_paths_not_migrated",
    ],
  );
});

test("preview has no database write path and does not mutate supplied state", async () => {
  const existing = Object.freeze([
    Object.freeze({
      id: "existing-id",
      legacy_id: "different-record",
      region: "Garden",
      slug: "different-record",
      lifecycle: "Published",
    }),
  ]);
  const before = JSON.stringify(existing);
  buildV1MigrationPreview({ existingContents: existing });
  assert.equal(JSON.stringify(existing), before);

  const serviceSource = await readFile(
    new URL("../scripts/content-v1/preview.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(serviceSource, /supabase|createClient|\.insert\(|\.upsert\(|\.delete\(/i);
});

test("changed source invalidates the approved preview snapshot", () => {
  const source = extractV1Content();
  const resolutionInput = testResolutionInput();
  const approvedPreview = buildV1MigrationPreview({
    extract: source,
    resolutionInput,
  });
  const approval = {
    schemaVersion: 1 as const,
    approved: true as const,
    previewDigest: approvedPreview.previewDigest,
    sourceDigest: approvedPreview.sourceDigest,
    destinationStateDigest: approvedPreview.destinationStateDigest,
  };
  const changedSource = structuredClone(source);
  changedSource.garden[0].summary = `${changedSource.garden[0].summary} changed`;
  const changedPreview = buildV1MigrationPreview({
    extract: changedSource,
    resolutionInput,
  });

  assert.notEqual(changedPreview.sourceDigest, approvedPreview.sourceDigest);
  assert.deepEqual(validateV1ApprovedPreviewSnapshot(approval, changedPreview), {
    valid: false,
    reason: "source_state_changed",
  });
});

test("approval contract generates matching source, destination, and preview digests", () => {
  const preview = buildV1MigrationPreview({
    resolutionInput: testResolutionInput(),
  });
  const approval = {
    schemaVersion: 1 as const,
    approved: true as const,
    previewDigest: preview.approval.previewDigest,
    sourceDigest: preview.approval.sourceDigest,
    destinationStateDigest: preview.approval.destinationStateDigest,
  };

  assert.match(approval.previewDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(approval.previewDigest, preview.approval.previewDigest);
  assert.equal(approval.sourceDigest, preview.approval.sourceDigest);
  assert.equal(
    approval.destinationStateDigest,
    preview.approval.destinationStateDigest,
  );
  assert.equal(preview.approval.importReady, true);
  assert.equal(preview.summary.ready, 19);
  assert.deepEqual(validateV1ApprovedPreviewSnapshot(approval, preview), {
    valid: true,
  });
});

test("execute remains rejected and no import execution occurs", async () => {
  const report = await buildV1DryRunReport({
    preview: true,
    execute: true,
    production: false,
    existingPath: null,
    resolutionsPath: null,
    outputPath: null,
  });

  assert.ok(report.failures.some((failure) => failure.code === "writes_not_implemented"));
  assert.equal(report.readiness.importReady, false);

  const applySource = await readFile(
    new URL("../scripts/content-v1/apply.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(applySource, /supabase|createClient|\.insert\(|\.upsert\(|\.delete\(/i);
});

test("existing content and route conflicts are detected without deduplication writes", () => {
  const bundle = transformV1Content();
  const firstReady = bundle.contents.find((content) => content.growthStage);
  assert.ok(firstReady);

  const existing = {
    ...firstReady,
    id: "existing-content-id",
    legacy_id: firstReady.legacyId,
    content_type: firstReady.contentType,
    detail_level: firstReady.detailLevel,
    growth_stage: firstReady.growthStage,
    title_zh: firstReady.titleZh,
    title_en: firstReady.titleEn,
    summary_zh: firstReady.summaryZh,
    summary_en: firstReady.summaryEn,
    body_zh_markdown: firstReady.bodyZhMarkdown,
    body_en_markdown: firstReady.bodyEnMarkdown,
    content_language: firstReady.contentLanguage,
    primary_categories: firstReady.primaryCategories,
    cover_image_path: firstReady.cover?.path ?? null,
    cover_image_alt_zh: firstReady.cover?.altZh ?? null,
    cover_image_alt_en: firstReady.cover?.altEn ?? null,
    manual_order: firstReady.manualOrder,
    published_at: firstReady.publishedAt,
    archived_at: firstReady.archivedAt,
    last_tended_at: firstReady.lastTendedAt,
  };
  const unchangedPreview = buildV1MigrationPreview({
    existingContents: [existing],
  });
  const unchanged = unchangedPreview.records.find(
    (record) => record.sourceIdentity.legacyId === firstReady.legacyId,
  );
  assert.equal(unchanged?.plannedOperation, "Unchanged");
  assert.equal(unchanged?.destinationIdentity.existingContentId, "existing-content-id");

  const conflictPreview = buildV1MigrationPreview({
    existingContents: [
      { ...existing, legacyId: undefined, legacy_id: "another-owner" },
    ],
  });
  const conflict = conflictPreview.records.find(
    (record) => record.sourceIdentity.legacyId === firstReady.legacyId,
  );
  assert.equal(conflict?.validationStatus, "Blocked");
  assert.ok(
    conflict?.blockers.some(
      (blocker) => blocker.code === "destination_slug_conflict",
    ),
  );
});
