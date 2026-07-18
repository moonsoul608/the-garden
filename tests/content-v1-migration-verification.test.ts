import assert from "node:assert/strict";
import test from "node:test";

import type {
  V1ImportDestinationContent,
  V1ImportResult,
  V1MigrationResolutionInput,
} from "../types/content.ts";
import {
  verifyV1Migration,
  type V1MigrationVerificationInput,
  type V1MigrationVerificationQueryResults,
} from "../scripts/content-v1/migration-verification.ts";
import { buildV1MigrationPreview } from "../scripts/content-v1/preview.ts";
import {
  applyV1MigrationResolutions,
  V1_GROWTH_STAGE_BLOCKER_IDS,
} from "../scripts/content-v1/resolutions.ts";
import { transformV1Content } from "../scripts/content-v1/transform.ts";

function resolutionInput(): V1MigrationResolutionInput {
  return {
    schemaVersion: 1,
    kind: "v1-migration-resolution-input",
    growthStages: V1_GROWTH_STAGE_BLOCKER_IDS.map((legacyId) => ({
      source: "v1-static-typescript",
      legacyId,
      route: `/lake/${legacyId}`,
      growthStage: "Seed",
      decisionMethod: "manual",
      resolutionSource: "06D verification test fixture",
      approvedBy: "test-garden-keeper",
      approvedAt: "2026-07-17T00:00:00.000Z",
      approvalStatus: "Approved",
      notes: "Test-only approval; not an editorial decision.",
    })),
  };
}

function fixture(): V1MigrationVerificationInput {
  const resolutions = resolutionInput();
  const preview = buildV1MigrationPreview({
    environment: "preview",
    resolutionInput: resolutions,
  });
  const bundle = applyV1MigrationResolutions(
    transformV1Content(),
    resolutions,
  ).bundle;
  const contentIdByLegacyId = new Map<string, string>();
  const contents: V1ImportDestinationContent[] = bundle.contents.map((content, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    contentIdByLegacyId.set(content.legacyId, id);
    return {
      id,
      legacy_id: content.legacyId,
      slug: content.slug,
      region: content.region,
      content_type: content.contentType,
      detail_level: content.detailLevel,
      lifecycle: content.lifecycle,
      growth_stage: content.growthStage!,
      title_zh: content.titleZh,
      title_en: content.titleEn,
      summary_zh: content.summaryZh,
      summary_en: content.summaryEn,
      body_zh_markdown: content.bodyZhMarkdown,
      body_en_markdown: content.bodyEnMarkdown,
      content_language: content.contentLanguage,
      primary_categories: [...content.primaryCategories],
      cover_image_path: content.cover?.path ?? null,
      cover_image_alt_zh: content.cover?.altZh ?? null,
      cover_image_alt_en: content.cover?.altEn ?? null,
      featured: content.featured,
      manual_order: content.manualOrder,
      published_at: content.publishedAt,
      archived_at: content.archivedAt,
      last_tended_at: content.lastTendedAt,
    };
  });
  const previewByLegacyId = new Map(
    preview.records.map((record) => [record.sourceIdentity.legacyId, record]),
  );
  const versions: V1MigrationVerificationQueryResults["versions"] = contents.map(
    (content, index) => {
      const legacyId = content.legacy_id!;
      const expected = previewByLegacyId.get(legacyId)!;
      const cover = content.cover_image_path
        ? {
            path: content.cover_image_path,
            altZh: content.cover_image_alt_zh,
            altEn: content.cover_image_alt_en,
          }
        : null;
      return {
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        content_id: content.id,
        checkpoint_reason: "V1 import",
        checkpoint_note: "Initial immutable V1 migration checkpoint.",
        created_at: "2026-07-17T12:00:00.000Z",
        created_by: null,
        snapshot: {
          projection: {
            id: content.id,
            legacyId,
            slug: content.slug,
            region: content.region,
            contentType: content.content_type,
            detailLevel: content.detail_level,
            lifecycle: content.lifecycle,
            growthStage: content.growth_stage,
            titleZh: content.title_zh,
            titleEn: content.title_en,
            summaryZh: content.summary_zh,
            summaryEn: content.summary_en,
            bodyZhMarkdown: content.body_zh_markdown,
            bodyEnMarkdown: content.body_en_markdown,
            contentLanguage: content.content_language,
            primaryCategories: [...content.primary_categories],
            cover,
            featured: content.featured,
            manualOrder: content.manual_order,
            publishedAt: content.published_at,
            archivedAt: content.archived_at,
            lastTendedAt: content.last_tended_at,
          },
          tags: [],
          relations: [],
          growthNotes: [],
          cover,
          migration: {
            source: "v1-static-typescript",
            sourceVersion: 1,
            legacyId,
            importDigest: preview.previewDigest,
            sourceDigest: preview.sourceDigest,
            growthStageResolution: expected.growthStageResolution,
          },
        },
      };
    },
  );
  const relations: V1MigrationVerificationQueryResults["relations"] =
    bundle.relations.map((relation, index) => ({
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      source_content_id: contentIdByLegacyId.get(relation.sourceLegacyId)!,
      target_content_id: contentIdByLegacyId.get(relation.targetLegacyId)!,
      relation_type: relation.relationType,
      note_zh: relation.noteZh,
      note_en: relation.noteEn,
    }));
  const executionReport: V1ImportResult = {
    schemaVersion: 1,
    kind: "v1-import-result",
    importDigest: preview.previewDigest,
    importedAt: "2026-07-17T12:00:00.000Z",
    sourceVersion: { source: "v1-static-typescript", schemaVersion: 1 },
    idempotent: false,
    created: {
      contents: bundle.contents.map((content) => content.legacyId),
      versions: versions.map((version) => version.id),
      relations: bundle.relations.map(
        (relation) =>
          `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`,
      ),
      growthNotes: [],
      tags: [],
      contentTags: [],
    },
    skippedRecords: [],
    warnings: preview.warnings,
    verification: {
      contentCount: contents.length,
      expectedContentCount: contents.length,
      slugUnique: true,
      relationIntegrity: true,
      lifecycleValid: true,
      passed: true,
    },
  };
  const queryResults: V1MigrationVerificationQueryResults = {
    schemaVersion: 1,
    kind: "v1-migration-verification-query-results",
    capturedAt: "2026-07-17T12:05:00.000Z",
    contents,
    versions,
    relations,
    tags: [],
    contentTags: [],
    growthNotes: [],
    publicReads: [
      ...contents.map((content) => ({
        probeId: `published:${content.legacy_id}`,
        legacyId: content.legacy_id,
        lifecycle: "Published" as const,
        collectionVisible: true,
        routeDisposition: "published" as const,
      })),
      {
        probeId: "archived-control",
        legacyId: null,
        lifecycle: "Archived",
        collectionVisible: false,
        routeDisposition: "archived",
      },
      {
        probeId: "draft-control",
        legacyId: null,
        lifecycle: "Draft",
        collectionVisible: false,
        routeDisposition: "not_found",
      },
      {
        probeId: "review-control",
        legacyId: null,
        lifecycle: "Review",
        collectionVisible: false,
        routeDisposition: "not_found",
      },
    ],
  };
  return { executionReport, expectedPreview: preview, queryResults };
}

function check(input: V1MigrationVerificationInput, id: string) {
  return verifyV1Migration(input).checksPerformed.find((item) => item.id === id);
}

test("a complete migration snapshot passes correctness checks and retains warnings", () => {
  const report = verifyV1Migration(fixture());
  assert.equal(report.status, "WARNING");
  assert.equal(report.sections.find((section) => section.name === "Content")?.status, "PASS");
  assert.equal(report.sections.find((section) => section.name === "Relations")?.status, "PASS");
  assert.equal(report.sections.find((section) => section.name === "Versions")?.status, "PASS");
  assert.equal(report.sections.find((section) => section.name === "Metadata")?.status, "WARNING");
  assert.match(report.verificationDigest, /^sha256:[a-f0-9]{64}$/);
});

test("missing content is detected", () => {
  const input = fixture();
  const removed = input.queryResults.contents.shift();
  assert.ok(removed?.legacy_id);
  const finding = check(input, "missing_content");
  assert.equal(finding?.status, "FAIL");
  assert.deepEqual(finding?.identities, [removed.legacy_id]);
});

test("a slug mismatch is detected", () => {
  const input = fixture();
  const changed = input.queryResults.contents[0];
  changed.slug = `${changed.slug}-changed`;
  const finding = check(input, "slug_preserved");
  assert.equal(finding?.status, "FAIL");
  assert.deepEqual(finding?.identities, [changed.legacy_id]);
});

test("a relation target mismatch is detected", () => {
  const input = fixture();
  const relation = input.queryResults.relations[0];
  relation.target_content_id = input.queryResults.contents.find(
    (content) =>
      content.id !== relation.source_content_id &&
      content.id !== relation.target_content_id,
  )!.id;
  assert.equal(check(input, "relation_targets")?.status, "FAIL");
});

test("a missing initial version is detected", () => {
  const input = fixture();
  const removed = input.queryResults.versions.shift();
  assert.ok(removed);
  const finding = check(input, "initial_version_count");
  assert.equal(finding?.status, "FAIL");
  assert.equal(finding?.identities.length, 1);
});

test("verification is deterministic for equivalent query ordering", () => {
  const firstInput = fixture();
  const secondInput = structuredClone(firstInput);
  secondInput.queryResults.contents.reverse();
  secondInput.queryResults.versions.reverse();
  secondInput.queryResults.relations.reverse();
  secondInput.queryResults.publicReads.reverse();
  const first = verifyV1Migration(firstInput);
  const second = verifyV1Migration(secondInput);
  assert.deepEqual(second, first);
  assert.equal(second.verificationDigest, first.verificationDigest);
});
