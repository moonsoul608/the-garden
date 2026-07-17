import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type {
  V1ImportDestinationContent,
  V1ImportExecutionPayload,
  V1ImportResult,
  V1MigrationResolutionInput,
} from "../types/content.ts";
import {
  executeV1Import,
  V1ImportExecutionError,
  type V1ImportExecutionBoundary,
} from "../scripts/content-v1/executor.ts";
import { buildV1MigrationPreview } from "../scripts/content-v1/preview.ts";
import { V1_GROWTH_STAGE_BLOCKER_IDS } from "../scripts/content-v1/resolutions.ts";

function resolutionInput(): V1MigrationResolutionInput {
  return {
    schemaVersion: 1,
    kind: "v1-migration-resolution-input",
    growthStages: V1_GROWTH_STAGE_BLOCKER_IDS.map((legacyId) => ({
      legacyId,
      growthStage: "Seed",
      decisionMethod: "manual",
      resolutionSource: "06C test fixture",
      approvedBy: "test-garden-keeper",
      approvedAt: "2026-07-17T00:00:00.000Z",
      approvalStatus: "Approved",
    })),
  };
}

function approvedInput() {
  const resolutions = resolutionInput();
  const preview = buildV1MigrationPreview({
    environment: "preview",
    resolutionInput: resolutions,
  });
  return {
    resolutions,
    preview,
    approval: {
      schemaVersion: 1 as const,
      approved: true as const,
      previewDigest: preview.previewDigest,
      sourceDigest: preview.sourceDigest,
      destinationStateDigest: preview.destinationStateDigest,
    },
  };
}

class MemoryImportBoundary implements V1ImportExecutionBoundary {
  readonly receipts = new Map<string, V1ImportResult>();
  readonly destinationContents: V1ImportDestinationContent[] = [];
  atomicCalls = 0;
  committedContents = 0;
  committedVersions = 0;
  failAfterStaging = false;
  lastPayload: V1ImportExecutionPayload | null = null;

  async findImportResult(importDigest: string) {
    return structuredClone(this.receipts.get(importDigest) ?? null);
  }

  async readDestinationContents() {
    return structuredClone(this.destinationContents);
  }

  async executeAtomicImport(payload: V1ImportExecutionPayload) {
    this.atomicCalls += 1;
    this.lastPayload = structuredClone(payload);
    const stagedContents = payload.contents.length;
    const stagedVersions = payload.contents.length;
    if (this.failAfterStaging) throw new Error("injected transaction failure");

    const result: V1ImportResult = {
      schemaVersion: 1,
      kind: "v1-import-result",
      importDigest: payload.importDigest,
      importedAt: "2026-07-17T12:00:00.000Z",
      sourceVersion: payload.sourceVersion,
      idempotent: false,
      created: {
        contents: payload.contents.map((content) => content.legacyId),
        versions: payload.contents.map((content) => `version:${content.legacyId}`),
        relations: payload.relations.map(
          (relation) =>
            `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`,
        ),
        growthNotes: [],
        tags: payload.tags.map((tag) => tag.normalizedName),
        contentTags: payload.contentTags.map(
          (contentTag) =>
            `${contentTag.contentLegacyId}:${contentTag.tagNormalizedName}`,
        ),
      },
      skippedRecords: [],
      warnings: payload.warnings,
      verification: {
        contentCount: stagedContents,
        expectedContentCount: stagedContents,
        slugUnique: true,
        relationIntegrity: true,
        lifecycleValid: true,
        passed: true,
      },
    };
    this.committedContents += stagedContents;
    this.committedVersions += stagedVersions;
    this.receipts.set(payload.importDigest, structuredClone(result));
    return result;
  }
}

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof V1ImportExecutionError);
    assert.equal(error.code, code);
    return true;
  });
}

test("invalid or missing approval is rejected before the migration boundary", async () => {
  const { resolutions, preview } = approvedInput();
  const boundary = new MemoryImportBoundary();
  await rejectsWithCode(
    executeV1Import(
      {
        approvedSnapshot: null,
        matchingDigest: preview.previewDigest,
        resolutionInput: resolutions,
      },
      boundary,
    ),
    "approved_snapshot_missing",
  );
  assert.equal(boundary.atomicCalls, 0);
});

test("an explicit digest mismatch is rejected", async () => {
  const { approval, resolutions } = approvedInput();
  const boundary = new MemoryImportBoundary();
  await rejectsWithCode(
    executeV1Import(
      {
        approvedSnapshot: approval,
        matchingDigest: `sha256:${"0".repeat(64)}`,
        resolutionInput: resolutions,
      },
      boundary,
    ),
    "matching_digest_mismatch",
  );
  assert.equal(boundary.atomicCalls, 0);
});

test("duplicate execution returns the durable result without duplicate writes", async () => {
  const { approval, resolutions } = approvedInput();
  const boundary = new MemoryImportBoundary();
  const options = {
    approvedSnapshot: approval,
    matchingDigest: approval.previewDigest,
    resolutionInput: resolutions,
  };

  const first = await executeV1Import(options, boundary);
  const second = await executeV1Import(options, boundary);

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(boundary.atomicCalls, 1);
  assert.equal(boundary.committedContents, 19);
  assert.equal(boundary.committedVersions, 19);
});

test("a transaction failure leaves no partial content or versions", async () => {
  const { approval, resolutions } = approvedInput();
  const boundary = new MemoryImportBoundary();
  boundary.failAfterStaging = true;

  await assert.rejects(
    executeV1Import(
      {
        approvedSnapshot: approval,
        matchingDigest: approval.previewDigest,
        resolutionInput: resolutions,
      },
      boundary,
    ),
    /injected transaction failure/,
  );
  assert.equal(boundary.committedContents, 0);
  assert.equal(boundary.committedVersions, 0);
  assert.equal(boundary.receipts.size, 0);
});

test("only resolvable, unique relations cross the execution boundary", async () => {
  const { approval, resolutions } = approvedInput();
  const boundary = new MemoryImportBoundary();
  await executeV1Import(
    {
      approvedSnapshot: approval,
      matchingDigest: approval.previewDigest,
      resolutionInput: resolutions,
    },
    boundary,
  );

  const payload = boundary.lastPayload;
  assert.ok(payload);
  assert.equal(payload.relations.length, 4);
  const contentIds = new Set(payload.contents.map((content) => content.legacyId));
  const relationIds = payload.relations.map(
    (relation) =>
      `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`,
  );
  assert.equal(new Set(relationIds).size, relationIds.length);
  assert.ok(
    payload.relations.every(
      (relation) =>
        contentIds.has(relation.sourceLegacyId) &&
        contentIds.has(relation.targetLegacyId),
    ),
  );
});

test("execution creates one immutable initial version per imported content", async () => {
  const { approval, resolutions } = approvedInput();
  const boundary = new MemoryImportBoundary();
  const result = await executeV1Import(
    {
      approvedSnapshot: approval,
      matchingDigest: approval.previewDigest,
      resolutionInput: resolutions,
    },
    boundary,
  );

  assert.equal(result.created.contents.length, 19);
  assert.equal(result.created.versions.length, 19);
  assert.equal(new Set(result.created.versions).size, 19);
});

test("SQL execution boundary is one transaction and service-role-only", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260717190000_phase_06c_v1_import_execution.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute[^;]+to service_role/i);
  assert.match(sql, /revoke all[^;]+from public, anon, authenticated/i);
  assert.match(sql, /post_import_verification_failed/);
  assert.doesNotMatch(sql, /grant execute[^;]+to (?:anon|authenticated)/i);
});
