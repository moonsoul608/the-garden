import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildV1MigrationPreview,
  formatV1MigrationPreview,
  validateV1ApprovedPreviewSnapshot,
} from "../scripts/content-v1/preview.ts";
import { extractV1Content } from "../scripts/content-v1/extract.ts";
import { transformV1Content } from "../scripts/content-v1/transform.ts";

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
  assert.ok(
    preview.blockers.some(
      (blocker) =>
        blocker.code === "publication_timestamp_policy_unresolved" &&
        blocker.field === "publishedAt",
    ),
  );
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
  assert.match(human, /Missing\/conflicting field: growthStage/);
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
  const approvedPreview = buildV1MigrationPreview({ extract: source });
  const approval = {
    schemaVersion: 1 as const,
    approved: true as const,
    previewDigest: approvedPreview.previewDigest,
    sourceDigest: approvedPreview.sourceDigest,
    destinationStateDigest: approvedPreview.destinationStateDigest,
  };
  const changedSource = structuredClone(source);
  changedSource.garden[0].summary = `${changedSource.garden[0].summary} changed`;
  const changedPreview = buildV1MigrationPreview({ extract: changedSource });

  assert.notEqual(changedPreview.sourceDigest, approvedPreview.sourceDigest);
  assert.deepEqual(validateV1ApprovedPreviewSnapshot(approval, changedPreview), {
    valid: false,
    reason: "source_state_changed",
  });
});

test("approval contract generates matching source, destination, and preview digests", () => {
  const preview = buildV1MigrationPreview();
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
  assert.deepEqual(validateV1ApprovedPreviewSnapshot(approval, preview), {
    valid: true,
  });
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
