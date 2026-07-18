import type {
  V1ApprovedMigrationSnapshot,
  V1ImportDestinationContent,
  V1ImportExecutionPayload,
  V1ImportPreflightReport,
  V1ImportResult,
  V1ImportSafetyState,
  V1MigrationResolutionInput,
} from "../../types/content.ts";

import {
  buildV1ApprovedMigrationSnapshot,
  parseV1ApprovedMigrationSnapshot,
  V1ApprovedMigrationSnapshotError,
  validateV1ApprovedMigrationSnapshot,
} from "./approved-snapshot.ts";
import { extractV1Content, type V1ExtractManifest } from "./extract.ts";
import { buildV1MigrationPreview } from "./preview.ts";
import { isV1ImportVerificationPassed } from "./migration-verification.ts";
import { stableV1MigrationJson } from "./digest.ts";

export class V1ImportExecutionError extends Error {
  readonly code: string;
  readonly status: Extract<V1ImportSafetyState, "BLOCKED" | "FAILED">;

  constructor(
    code: string,
    message: string,
    status: Extract<V1ImportSafetyState, "BLOCKED" | "FAILED"> = "BLOCKED",
  ) {
    super(message);
    this.name = "V1ImportExecutionError";
    this.code = code;
    this.status = status;
  }
}

export type V1ImportExecutionBoundary = {
  findImportResult(importDigest: string): Promise<V1ImportResult | null>;
  readDestinationContents(): Promise<V1ImportDestinationContent[]>;
  executeAtomicImport(payload: V1ImportExecutionPayload): Promise<V1ImportResult>;
};

export type V1ImportExecutionOptions = {
  approvedSnapshot: V1ApprovedMigrationSnapshot | null;
  matchingDigest: string;
  resolutionInput: V1MigrationResolutionInput | null;
  extract?: V1ExtractManifest;
};

function executionError(code: string, message: string): never {
  throw new V1ImportExecutionError(code, message);
}

function requireApprovedSnapshot(
  value: unknown,
): V1ApprovedMigrationSnapshot {
  try {
    return parseV1ApprovedMigrationSnapshot(value);
  } catch (error) {
    if (error instanceof V1ApprovedMigrationSnapshotError) {
      return executionError(error.code, error.message);
    }
    return executionError(
      "incomplete_approval",
      "The approved migration snapshot could not be validated.",
    );
  }
}

function validateRelations(
  payload: Pick<V1ImportExecutionPayload, "contents" | "relations">,
): void {
  const contentIds = new Set(payload.contents.map((content) => content.legacyId));
  const relationIds = new Set<string>();

  for (const relation of payload.relations) {
    const identity = `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`;
    if (relationIds.has(identity)) {
      executionError(
        "duplicate_relation",
        `Relation ${identity} is duplicated in the approved import payload.`,
      );
    }
    relationIds.add(identity);
    if (
      !contentIds.has(relation.sourceLegacyId) ||
      !contentIds.has(relation.targetLegacyId)
    ) {
      executionError(
        "missing_relation_target",
        `Relation ${identity} has a missing source or target.`,
      );
    }
  }
}

function buildPayload(
  approved: V1ApprovedMigrationSnapshot,
  destinationContents: V1ImportDestinationContent[],
  resolutionInput: V1MigrationResolutionInput | null,
  extract: V1ExtractManifest,
): V1ImportExecutionPayload {
  const preview = buildV1MigrationPreview({
    environment: "preview",
    existingContents: destinationContents,
    resolutionInput,
    extract,
  });
  const regeneratedSnapshot = buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput,
    createdAt: approved.createdAt,
    extract,
    existingContents: destinationContents,
  });
  if (
    regeneratedSnapshot.digests.snapshotDigest !==
    approved.digests.snapshotDigest
  ) {
    executionError(
      "snapshot_content_mismatch",
      "The approved snapshot content no longer matches the regenerated import inputs.",
    );
  }
  const approvalValidation = validateV1ApprovedMigrationSnapshot(
    approved,
    preview,
  );
  if (!approvalValidation.valid) {
    executionError(
      approvalValidation.reason,
      `Approved preview preflight failed: ${approvalValidation.reason}.`,
    );
  }

  const existingIdentity = preview.records.find(
    (record) => record.plannedOperation !== "Create",
  );
  if (existingIdentity) {
    executionError(
      "existing_migration_identity_without_receipt",
      `Migration identity ${existingIdentity.sourceIdentity.legacyId} already exists without this import digest receipt.`,
    );
  }

  const contents = approved.records.map((record) => {
    if (!record.sourceRecord.growthStage) {
      return executionError(
        "unresolved_growth_stage",
        `Growth Stage remains unresolved for ${record.sourceRecord.legacyId}.`,
      );
    }
    return {
      ...structuredClone(record.sourceRecord),
      growthStage: record.sourceRecord.growthStage,
      growthStageResolution: structuredClone(record.growthStageResolution),
    };
  });

  const payload: V1ImportExecutionPayload = {
    schemaVersion: 1,
    kind: "v1-import-execution",
    importDigest: approved.digests.snapshotDigest,
    previewDigest: approved.digests.previewDigest,
    resolutionDigest: approved.digests.resolutionDigest,
    sourceDigest: approved.digests.sourceDigest,
    destinationStateDigest: approved.digests.destinationStateDigest,
    sourceVersion: {
      source: "v1-static-typescript",
      schemaVersion: 1,
    },
    expectedDestinationContents: structuredClone(destinationContents),
    contents,
    relations: structuredClone(approved.relations),
    tags: structuredClone(approved.tags),
    contentTags: structuredClone(approved.contentTags),
    // V1 has no structured Growth Note records. Detail sections named
    // "Growth notes" remain part of the preserved Markdown body.
    growthNotes: [],
    warnings: structuredClone(approved.warnings),
  };
  validateRelations(payload);
  return payload;
}

function validateResult(
  result: V1ImportResult,
  approved: V1ApprovedMigrationSnapshot,
): V1ImportResult {
  const expectedContents = approved.records.map(
    (record) => record.sourceRecord.legacyId,
  );
  const expectedRelations = approved.relations.map(
    (relation) =>
      `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`,
  );
  const expectedTags = approved.tags.map((tag) => tag.normalizedName);
  const expectedContentTags = approved.contentTags.map(
    (contentTag) =>
      `${contentTag.contentLegacyId}:${contentTag.tagNormalizedName}`,
  );
  if (
    result?.schemaVersion !== 1 ||
    result.kind !== "v1-import-result" ||
    result.status !== "SUCCESS" ||
    result.snapshotDigest !== approved.digests.snapshotDigest ||
    result.importDigest !== approved.digests.snapshotDigest ||
    result.previewDigest !== approved.digests.previewDigest ||
    result.resolutionDigest !== approved.digests.resolutionDigest ||
    Number.isNaN(Date.parse(result.importedAt)) ||
    result.importedCount !== result.created?.contents.length ||
    result.importedCount !== approved.records.length ||
    stableV1MigrationJson(result.created?.contents) !==
      stableV1MigrationJson(expectedContents) ||
    result.created?.versions.length !== approved.records.length ||
    stableV1MigrationJson(result.created?.relations) !==
      stableV1MigrationJson(expectedRelations) ||
    stableV1MigrationJson(result.created?.tags) !==
      stableV1MigrationJson(expectedTags) ||
    stableV1MigrationJson(result.created?.contentTags) !==
      stableV1MigrationJson(expectedContentTags) ||
    result.skippedRecords?.length !== 0 ||
    stableV1MigrationJson(result.warnings) !==
      stableV1MigrationJson(approved.warnings) ||
    !isV1ImportVerificationPassed(result.verification) ||
    result.verification.contentCount !== approved.records.length ||
    result.verification.expectedContentCount !== approved.records.length
  ) {
    throw new V1ImportExecutionError(
      "post_import_verification_failed",
      "The transaction boundary returned an invalid or unverified import receipt.",
      "FAILED",
    );
  }
  return result;
}

type PreparedV1Import = {
  approved: V1ApprovedMigrationSnapshot;
  existingResult: V1ImportResult | null;
  payload: V1ImportExecutionPayload | null;
};

async function prepareV1Import(
  options: V1ImportExecutionOptions,
  boundary: V1ImportExecutionBoundary,
): Promise<PreparedV1Import> {
  const approved = requireApprovedSnapshot(options.approvedSnapshot);
  if (options.matchingDigest !== approved.digests.snapshotDigest) {
    executionError(
      "matching_digest_mismatch",
      "The explicitly supplied digest does not match the approved migration snapshot.",
    );
  }

  const extract = options.extract ?? extractV1Content();
  const sourceCheck = buildV1MigrationPreview({
    extract,
    resolutionInput: options.resolutionInput,
  });
  if (
    sourceCheck.resolutionReport.resolutionDigest !==
    approved.digests.resolutionDigest
  ) {
    executionError(
      "resolution_state_changed",
      "The approved Growth Stage resolution changed after snapshot approval.",
    );
  }
  if (sourceCheck.sourceDigest !== approved.digests.sourceDigest) {
    executionError(
      "source_state_changed",
      "The V1 source changed after snapshot approval.",
    );
  }

  const existingResult = await boundary.findImportResult(
    approved.digests.snapshotDigest,
  );
  if (existingResult) {
    return {
      approved,
      existingResult: validateResult(existingResult, approved),
      payload: null,
    };
  }

  const destinationContents = await boundary.readDestinationContents();
  return {
    approved,
    existingResult: null,
    payload: buildPayload(
      approved,
      destinationContents,
      options.resolutionInput,
      extract,
    ),
  };
}

export async function preflightV1Import(
  options: V1ImportExecutionOptions,
  boundary: V1ImportExecutionBoundary,
): Promise<V1ImportPreflightReport> {
  try {
    const prepared = await prepareV1Import(options, boundary);
    return {
      schemaVersion: 1,
      kind: "v1-import-preflight",
      status: prepared.existingResult ? "SUCCESS" : "READY",
      snapshotDigest: prepared.approved.digests.snapshotDigest,
      blockers: [],
    };
  } catch (error) {
    const failure =
      error instanceof V1ImportExecutionError
        ? error
        : new V1ImportExecutionError(
            "preflight_failed",
            error instanceof Error ? error.message : "Import preflight failed.",
            "FAILED",
          );
    return {
      schemaVersion: 1,
      kind: "v1-import-preflight",
      status: failure.status,
      snapshotDigest: options.approvedSnapshot?.digests?.snapshotDigest ?? null,
      blockers: [{ code: failure.code, message: failure.message }],
    };
  }
}

export async function executeV1Import(
  options: V1ImportExecutionOptions,
  boundary: V1ImportExecutionBoundary,
): Promise<V1ImportResult> {
  const prepared = await prepareV1Import(options, boundary);
  if (prepared.existingResult) {
    return validateResult(
      { ...structuredClone(prepared.existingResult), idempotent: true },
      prepared.approved,
    );
  }
  if (!prepared.payload) {
    throw new V1ImportExecutionError(
      "import_payload_missing",
      "Import preflight did not produce an execution payload.",
      "FAILED",
    );
  }

  try {
    const result = await boundary.executeAtomicImport(prepared.payload);
    return validateResult(result, prepared.approved);
  } catch (error) {
    if (
      error instanceof V1ImportExecutionError &&
      error.status === "FAILED"
    ) {
      throw error;
    }
    throw new V1ImportExecutionError(
      error instanceof V1ImportExecutionError
        ? error.code
        : "atomic_import_failed",
      error instanceof Error
        ? error.message
        : "The atomic import transaction failed and was rolled back.",
      "FAILED",
    );
  }
}

export function formatV1ImportResult(result: V1ImportResult): string {
  const lines = [
    "V1 Import Execution Report",
    `Status: ${result.status}`,
    `Snapshot digest: ${result.snapshotDigest}`,
    `Import digest: ${result.importDigest}`,
    `Preview digest: ${result.previewDigest}`,
    `Resolution digest: ${result.resolutionDigest}`,
    `Timestamp: ${result.importedAt}`,
    `Imported count: ${result.importedCount}`,
    `Source version: ${result.sourceVersion.source}@${result.sourceVersion.schemaVersion}`,
    `Idempotent replay: ${result.idempotent ? "yes" : "no"}`,
    "",
    `Created contents: ${result.created.contents.length}`,
    `Created versions: ${result.created.versions.length}`,
    `Created relations: ${result.created.relations.length}`,
    `Skipped records: ${result.skippedRecords.length}`,
    `Warnings: ${result.warnings.length}`,
    "",
    `Verification: ${result.verification.passed ? "passed" : "failed"}`,
    `Content count: ${result.verification.contentCount}/${result.verification.expectedContentCount}`,
    `Slug uniqueness: ${result.verification.slugUnique ? "passed" : "failed"}`,
    `Slug identity: ${result.verification.slugIdentityValid ? "passed" : "failed"}`,
    `Regions: ${result.verification.regionsValid ? "passed" : "failed"}`,
    `Relation integrity: ${result.verification.relationIntegrity ? "passed" : "failed"}`,
    `Lifecycle validity: ${result.verification.lifecycleValid ? "passed" : "failed"}`,
    `Initial versions: ${result.verification.versionsValid ? "passed" : "failed"}`,
  ];

  if (result.created.contents.length > 0) {
    lines.push("", "Created content identities:");
    lines.push(...result.created.contents.map((legacyId) => `- ${legacyId}`));
  }
  if (result.skippedRecords.length > 0) {
    lines.push("", "Skipped identities:");
    lines.push(...result.skippedRecords.map((legacyId) => `- ${legacyId}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning.code}: ${warning.message}`));
  }
  return `${lines.join("\n")}\n`;
}
