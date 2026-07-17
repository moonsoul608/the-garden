import type {
  V1ApprovedPreviewSnapshot,
  V1ImportDestinationContent,
  V1ImportExecutionPayload,
  V1ImportResult,
  V1MigrationResolutionInput,
} from "../../types/content.ts";

import { extractV1Content, type V1ExtractManifest } from "./extract.ts";
import {
  buildV1MigrationPreview,
  validateV1ApprovedPreviewSnapshot,
} from "./preview.ts";
import { applyV1MigrationResolutions } from "./resolutions.ts";
import { transformV1Content } from "./transform.ts";

const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;

export class V1ImportExecutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "V1ImportExecutionError";
    this.code = code;
  }
}

export type V1ImportExecutionBoundary = {
  findImportResult(importDigest: string): Promise<V1ImportResult | null>;
  readDestinationContents(): Promise<V1ImportDestinationContent[]>;
  executeAtomicImport(payload: V1ImportExecutionPayload): Promise<V1ImportResult>;
};

export type V1ImportExecutionOptions = {
  approvedSnapshot: V1ApprovedPreviewSnapshot | null;
  matchingDigest: string;
  resolutionInput: V1MigrationResolutionInput | null;
  extract?: V1ExtractManifest;
};

function executionError(code: string, message: string): never {
  throw new V1ImportExecutionError(code, message);
}

function hasDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_DIGEST.test(value);
}

export function parseV1ApprovedPreviewSnapshot(
  value: unknown,
): V1ApprovedPreviewSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return executionError(
      "approved_snapshot_missing",
      "An approved preview snapshot is required.",
    );
  }

  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.approved !== true ||
    !hasDigest(snapshot.previewDigest) ||
    !hasDigest(snapshot.sourceDigest) ||
    !hasDigest(snapshot.destinationStateDigest)
  ) {
    return executionError(
      "incomplete_approval",
      "The approval must be schemaVersion 1, explicitly approved, and contain all three SHA-256 digests.",
    );
  }

  return snapshot as V1ApprovedPreviewSnapshot;
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
  approved: V1ApprovedPreviewSnapshot,
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
  const approvalValidation = validateV1ApprovedPreviewSnapshot(approved, preview);
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

  const resolution = applyV1MigrationResolutions(
    transformV1Content(extract),
    resolutionInput,
  );
  const previewByLegacyId = new Map(
    preview.records.map((record) => [record.sourceIdentity.legacyId, record]),
  );
  const contents = resolution.bundle.contents.map((content) => {
    if (!content.growthStage) {
      return executionError(
        "unresolved_growth_stage",
        `Growth Stage remains unresolved for ${content.legacyId}.`,
      );
    }
    return {
      ...content,
      growthStage: content.growthStage,
      growthStageResolution:
        previewByLegacyId.get(content.legacyId)?.growthStageResolution ?? null,
    };
  });

  const payload: V1ImportExecutionPayload = {
    schemaVersion: 1,
    kind: "v1-import-execution",
    importDigest: approved.previewDigest,
    sourceDigest: approved.sourceDigest,
    destinationStateDigest: approved.destinationStateDigest,
    sourceVersion: {
      source: "v1-static-typescript",
      schemaVersion: 1,
    },
    expectedDestinationContents: structuredClone(destinationContents),
    contents,
    relations: structuredClone(resolution.bundle.relations),
    tags: structuredClone(resolution.bundle.tags),
    contentTags: structuredClone(resolution.bundle.contentTags),
    // V1 has no structured Growth Note records. Detail sections named
    // "Growth notes" remain part of the preserved Markdown body.
    growthNotes: [],
    warnings: structuredClone(preview.warnings),
  };
  validateRelations(payload);
  return payload;
}

function validateResult(
  result: V1ImportResult,
  expectedDigest: string,
): V1ImportResult {
  if (
    result?.schemaVersion !== 1 ||
    result.kind !== "v1-import-result" ||
    result.importDigest !== expectedDigest ||
    !result.verification?.passed
  ) {
    executionError(
      "invalid_import_result",
      "The transaction boundary returned an invalid or unverified import result.",
    );
  }
  return result;
}

export async function executeV1Import(
  options: V1ImportExecutionOptions,
  boundary: V1ImportExecutionBoundary,
): Promise<V1ImportResult> {
  const approved = parseV1ApprovedPreviewSnapshot(options.approvedSnapshot);
  if (options.matchingDigest !== approved.previewDigest) {
    executionError(
      "matching_digest_mismatch",
      "The explicitly supplied digest does not match the approved preview snapshot.",
    );
  }

  const extract = options.extract ?? extractV1Content();
  const sourceCheck = buildV1MigrationPreview({
    extract,
    resolutionInput: options.resolutionInput,
  });
  if (sourceCheck.sourceDigest !== approved.sourceDigest) {
    executionError(
      "source_state_changed",
      "The V1 source or approved resolution input changed after preview approval.",
    );
  }

  const existingResult = await boundary.findImportResult(approved.previewDigest);
  if (existingResult) {
    return validateResult(
      { ...structuredClone(existingResult), idempotent: true },
      approved.previewDigest,
    );
  }

  const destinationContents = await boundary.readDestinationContents();
  const payload = buildPayload(
    approved,
    destinationContents,
    options.resolutionInput,
    extract,
  );
  const result = await boundary.executeAtomicImport(payload);
  return validateResult(result, approved.previewDigest);
}

export function formatV1ImportResult(result: V1ImportResult): string {
  const lines = [
    "V1 Import Execution Report",
    `Import digest: ${result.importDigest}`,
    `Timestamp: ${result.importedAt}`,
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
    `Relation integrity: ${result.verification.relationIntegrity ? "passed" : "failed"}`,
    `Lifecycle validity: ${result.verification.lifecycleValid ? "passed" : "failed"}`,
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
