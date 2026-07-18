import type {
  V1ApprovedMigrationSnapshot,
  V1ApprovedMigrationSnapshotBlocker,
  V1MigrationContentRecord,
  V1MigrationPreview,
  V1MigrationResolutionInput,
} from "../../types/content.ts";

import {
  digestV1MigrationValue,
  stableV1MigrationJson,
  V1_SHA256_DIGEST_PATTERN,
} from "./digest.ts";
import { extractV1Content, type V1ExtractManifest } from "./extract.ts";
import {
  buildV1MigrationPreview,
  type V1ExistingContent,
} from "./preview.ts";
import { applyV1MigrationResolutions } from "./resolutions.ts";
import { transformV1Content } from "./transform.ts";
import { requiresGrowthStage } from "../../lib/content/validation.ts";
import {
  calculateV1MigrationSchemaDigest,
  doesV1GrowthStageApplicabilityPolicyPass,
  isCurrentV1MigrationValidationPolicy,
  V1_APPROVED_SNAPSHOT_VERSION,
} from "./validation-policy.ts";

export type V1ApprovedMigrationSnapshotOptions = {
  preview: V1MigrationPreview;
  resolutionInput: V1MigrationResolutionInput | null;
  createdAt: string;
  extract?: V1ExtractManifest;
  existingContents?: readonly V1ExistingContent[];
};

export type V1ApprovedMigrationSnapshotValidation =
  | { valid: true }
  | { valid: false; reason: string };

export class V1ApprovedMigrationSnapshotError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "V1ApprovedMigrationSnapshotError";
    this.code = code;
  }
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pushBlocker(
  blockers: V1ApprovedMigrationSnapshotBlocker[],
  blocker: V1ApprovedMigrationSnapshotBlocker,
): void {
  if (
    !blockers.some(
      (current) =>
        current.code === blocker.code &&
        current.legacyId === blocker.legacyId &&
        current.message === blocker.message,
    )
  ) {
    blockers.push(blocker);
  }
}

function completeSourceRecord(record: V1MigrationContentRecord): boolean {
  return Boolean(
    record.legacyId &&
      record.slug &&
      (record.growthStage !== null ||
        !requiresGrowthStage(record.region, record.contentType)) &&
      (record.titleZh || record.titleEn) &&
      (record.summaryZh || record.summaryEn) &&
      (record.bodyZhMarkdown || record.bodyEnMarkdown) &&
      record.primaryCategories.length > 0,
  );
}

function snapshotDigestInput(snapshot: V1ApprovedMigrationSnapshot): unknown {
  const boundDigests = {
    previewDigest: snapshot.digests.previewDigest,
    resolutionDigest: snapshot.digests.resolutionDigest,
    sourceDigest: snapshot.digests.sourceDigest,
    destinationStateDigest: snapshot.digests.destinationStateDigest,
    schemaDigest: snapshot.digests.schemaDigest,
  };
  return { ...snapshot, digests: boundDigests };
}

export function calculateV1ApprovedMigrationSnapshotDigest(
  snapshot: V1ApprovedMigrationSnapshot,
): string {
  return digestV1MigrationValue(snapshotDigestInput(snapshot));
}

export function buildV1ApprovedMigrationSnapshot(
  options: V1ApprovedMigrationSnapshotOptions,
): V1ApprovedMigrationSnapshot {
  const extract = options.extract ?? extractV1Content();
  const currentPreview = buildV1MigrationPreview({
    extract,
    existingContents: options.existingContents,
    resolutionInput: options.resolutionInput,
    environment: options.preview.environment,
  });
  const resolution = applyV1MigrationResolutions(
    transformV1Content(extract),
    options.resolutionInput,
  );
  const blockers: V1ApprovedMigrationSnapshotBlocker[] = [];

  if (options.preview.schemaVersion !== extract.schemaVersion) {
    pushBlocker(blockers, {
      code: "schema_version_mismatch",
      legacyId: null,
      message: "The preview schema version does not match the migration source schema.",
    });
  }
  if (
    !options.preview.validationPolicy ||
    !isCurrentV1MigrationValidationPolicy(options.preview.validationPolicy)
  ) {
    pushBlocker(blockers, {
      code: "validation_policy_mismatch",
      legacyId: null,
      message: "The supplied preview uses a different migration validation policy.",
    });
  }
  if (options.preview.schemaDigest !== currentPreview.schemaDigest) {
    pushBlocker(blockers, {
      code: "schema_digest_mismatch",
      legacyId: null,
      message: "The supplied preview schema digest does not match the current approval schema.",
    });
  }
  if (options.preview.environment !== "preview") {
    pushBlocker(blockers, {
      code: "preview_environment_required",
      legacyId: null,
      message: "Approval requires a Preview-environment migration preview.",
    });
  }
  if (options.preview.previewDigest !== currentPreview.previewDigest) {
    pushBlocker(blockers, {
      code: "preview_digest_mismatch",
      legacyId: null,
      message: "The supplied preview digest does not match the current preview.",
    });
  }
  if (
    options.preview.resolutionReport.resolutionDigest !==
    currentPreview.resolutionReport.resolutionDigest
  ) {
    pushBlocker(blockers, {
      code: "resolution_digest_mismatch",
      legacyId: null,
      message: "The supplied preview was generated from a different resolution input.",
    });
  }
  if (options.preview.sourceDigest !== currentPreview.sourceDigest) {
    pushBlocker(blockers, {
      code: "source_digest_mismatch",
      legacyId: null,
      message: "The supplied preview was generated from different source content.",
    });
  }
  if (
    options.preview.destinationStateDigest !==
    currentPreview.destinationStateDigest
  ) {
    pushBlocker(blockers, {
      code: "destination_state_mismatch",
      legacyId: null,
      message: "The supplied preview was generated from a different destination state.",
    });
  }
  if (
    options.preview.records.length !== resolution.bundle.contents.length ||
    currentPreview.records.length !== resolution.bundle.contents.length
  ) {
    pushBlocker(blockers, {
      code: "incomplete_records",
      legacyId: null,
      message: "The preview does not contain every source migration record.",
    });
  }
  if (!currentPreview.readiness.importReady) {
    pushBlocker(blockers, {
      code: "unresolved_blockers",
      legacyId: null,
      message: "The current preview still has unresolved import blockers.",
    });
  }
  if (!currentPreview.readiness.schemaCompatible) {
    pushBlocker(blockers, {
      code: "schema_compatibility_failed",
      legacyId: null,
      message: "The migration snapshot schema is not compatible with the current validation policy.",
    });
  }
  if (!currentPreview.readiness.applicabilityPassed) {
    pushBlocker(blockers, {
      code: "growth_stage_applicability_failed",
      legacyId: null,
      message: "Growth Stage applicability validation did not pass.",
    });
  }
  if (
    currentPreview.resolutionReport.validationStatus !== "Valid" ||
    currentPreview.resolutionReport.after.remaining !== 0 ||
    currentPreview.records.some(
      (record) =>
        requiresGrowthStage(record.region, record.contentType) &&
        record.growthStage === null,
    )
  ) {
    pushBlocker(blockers, {
      code: "growth_stages_unresolved",
      legacyId: null,
      message: "Every required Growth Stage must have a valid manual approval.",
    });
  }
  if (!isIsoTimestamp(options.createdAt)) {
    pushBlocker(blockers, {
      code: "invalid_created_timestamp",
      legacyId: null,
      message: "The approval creation timestamp must be an explicit ISO timestamp.",
    });
  }

  for (const record of currentPreview.records) {
    for (const blocker of record.blockers) {
      pushBlocker(blockers, {
        code: blocker.code,
        legacyId: record.sourceIdentity.legacyId,
        message: blocker.message,
      });
    }
  }
  for (const blocker of currentPreview.blockers) {
    pushBlocker(blockers, {
      code: blocker.code,
      legacyId: null,
      message: blocker.message,
    });
  }
  for (const failure of currentPreview.failures) {
    pushBlocker(blockers, failure);
  }
  for (const [kind, readiness] of Object.entries(currentPreview.childReadiness)) {
    for (const item of readiness.blockedItems) {
      pushBlocker(blockers, {
        code: `blocked_${kind}`,
        legacyId: null,
        message: `${item.identity} is not ready for approval.`,
      });
    }
  }

  const sourceByLegacyId = new Map(
    resolution.bundle.contents.map((record) => [record.legacyId, record]),
  );
  const records = currentPreview.records.flatMap((previewRecord) => {
    const sourceRecord = sourceByLegacyId.get(
      previewRecord.sourceIdentity.legacyId,
    );
    if (!sourceRecord) return [];
    if (!completeSourceRecord(sourceRecord)) {
      pushBlocker(blockers, {
        code: "incomplete_record",
        legacyId: sourceRecord.legacyId,
        message: `Source record ${sourceRecord.legacyId} is incomplete.`,
      });
    }
    return [
      {
        sourceRecord: structuredClone(sourceRecord),
        destinationMapping: {
          identity: structuredClone(previewRecord.destinationIdentity),
          plannedOperation: previewRecord.plannedOperation,
          recordDigest: previewRecord.recordDigest,
        },
        resolvedGrowthStage: sourceRecord.growthStage,
        growthStageResolution: structuredClone(
          previewRecord.growthStageResolution,
        ),
        warnings: structuredClone(previewRecord.warnings),
      },
    ];
  });

  const applicabilityPassed = doesV1GrowthStageApplicabilityPolicyPass(
    currentPreview.validationPolicy,
    records.map((record) => record.sourceRecord),
  );
  if (!applicabilityPassed) {
    pushBlocker(blockers, {
      code: "growth_stage_applicability_failed",
      legacyId: null,
      message: "The frozen source records do not pass the approved Growth Stage applicability policy.",
    });
  }

  const schemaCompatible =
    currentPreview.readiness.schemaCompatible &&
    currentPreview.schemaDigest ===
      calculateV1MigrationSchemaDigest(currentPreview.validationPolicy);
  const digestsMatch =
    options.preview.previewDigest === currentPreview.previewDigest &&
    options.preview.resolutionReport.resolutionDigest ===
      currentPreview.resolutionReport.resolutionDigest &&
    options.preview.sourceDigest === currentPreview.sourceDigest &&
    options.preview.destinationStateDigest ===
      currentPreview.destinationStateDigest &&
    options.preview.schemaDigest === currentPreview.schemaDigest;
  const previewPassed =
    currentPreview.readiness.importReady &&
    currentPreview.readiness.validationPassed;
  const blockersClear = blockers.length === 0;
  const checks = {
    blockersClear,
    previewPassed,
    schemaCompatible,
    applicabilityPassed,
    digestsMatch,
  };
  const approvalReady = Object.values(checks).every(Boolean);

  const nullableLakeGrowthStageCount = records.filter(
    (record) =>
      record.sourceRecord.region === "Lake" &&
      record.sourceRecord.contentType === "Reflection" &&
      record.sourceRecord.growthStage === null,
  ).length;

  const snapshot: V1ApprovedMigrationSnapshot = {
    snapshotVersion: V1_APPROVED_SNAPSHOT_VERSION,
    schemaVersion: 1,
    kind: "v1-approved-migration-snapshot",
    createdAt: options.createdAt,
    approvalStatus: approvalReady ? "Approved" : "Blocked",
    source: {
      name: "v1-static-typescript",
      schemaVersion: extract.schemaVersion,
      recordCount: resolution.bundle.contents.length,
    },
    metadata: {
      migrationTask: "08B-1",
      generatedBy: "content:v1:approve-snapshot",
      sourceMode: "v1-static-typescript",
      nullableLakeGrowthStage: {
        recordCount: nullableLakeGrowthStageCount,
        meaning: "not growth-tracked / not applicable",
        resolutionRequired: false,
      },
    },
    validationPolicy: structuredClone(currentPreview.validationPolicy),
    records,
    relations: structuredClone(resolution.bundle.relations),
    tags: structuredClone(resolution.bundle.tags),
    contentTags: structuredClone(resolution.bundle.contentTags),
    homeCuration: structuredClone(resolution.bundle.homeCuration),
    siteCopy: structuredClone(resolution.bundle.siteCopy),
    warnings: structuredClone(currentPreview.warnings),
    resolution: {
      validationStatus: currentPreview.resolutionReport.validationStatus,
      growthStages: structuredClone(
        currentPreview.resolutionReport.growthStages,
      ),
      publishedAt: structuredClone(
        currentPreview.resolutionReport.publishedAt,
      ),
    },
    preview: {
      environment: currentPreview.environment,
      status: currentPreview.status,
      recordCount: currentPreview.summary.total,
    },
    checks,
    blockers,
    digests: {
      snapshotDigest: "",
      previewDigest: currentPreview.previewDigest,
      resolutionDigest: currentPreview.resolutionReport.resolutionDigest,
      sourceDigest: currentPreview.sourceDigest,
      destinationStateDigest: currentPreview.destinationStateDigest,
      schemaDigest: currentPreview.schemaDigest,
    },
  };
  snapshot.digests.snapshotDigest =
    calculateV1ApprovedMigrationSnapshotDigest(snapshot);
  return snapshot;
}

function validateSnapshotStructure(
  snapshot: V1ApprovedMigrationSnapshot,
): V1ApprovedMigrationSnapshotValidation {
  if (
    snapshot.snapshotVersion !== V1_APPROVED_SNAPSHOT_VERSION ||
    snapshot.schemaVersion !== 1 ||
    snapshot.kind !== "v1-approved-migration-snapshot" ||
    snapshot.source?.schemaVersion !== 1
  ) {
    return { valid: false, reason: "snapshot_schema_mismatch" };
  }
  if (
    !snapshot.validationPolicy ||
    !isCurrentV1MigrationValidationPolicy(snapshot.validationPolicy)
  ) {
    return { valid: false, reason: "validation_policy_mismatch" };
  }
  if (
    snapshot.digests?.schemaDigest !==
    calculateV1MigrationSchemaDigest(snapshot.validationPolicy)
  ) {
    return { valid: false, reason: "schema_digest_mismatch" };
  }
  if (snapshot.approvalStatus !== "Approved" || snapshot.blockers.length > 0) {
    return { valid: false, reason: "snapshot_not_approved" };
  }
  if (!isIsoTimestamp(snapshot.createdAt)) {
    return { valid: false, reason: "snapshot_timestamp_invalid" };
  }
  if (
    !Object.values(snapshot.digests).every((value) =>
      V1_SHA256_DIGEST_PATTERN.test(value),
    )
  ) {
    return { valid: false, reason: "snapshot_digest_invalid" };
  }
  if (
    snapshot.digests.snapshotDigest !==
    calculateV1ApprovedMigrationSnapshotDigest(snapshot)
  ) {
    return { valid: false, reason: "snapshot_digest_mismatch" };
  }
  if (
    !snapshot.checks ||
    snapshot.checks.blockersClear !== true ||
    snapshot.checks.previewPassed !== true ||
    snapshot.checks.schemaCompatible !== true ||
    snapshot.checks.applicabilityPassed !== true ||
    snapshot.checks.digestsMatch !== true ||
    snapshot.metadata?.migrationTask !== "08B-1" ||
    snapshot.metadata?.generatedBy !== "content:v1:approve-snapshot" ||
    snapshot.metadata?.sourceMode !== "v1-static-typescript" ||
    !isObject(snapshot.metadata?.nullableLakeGrowthStage)
  ) {
    return { valid: false, reason: "snapshot_readiness_checks_failed" };
  }
  if (
    snapshot.records.length !== snapshot.source.recordCount ||
    snapshot.preview.recordCount !== snapshot.source.recordCount ||
    snapshot.records.some(
      (record) =>
        !isObject(record) ||
        !isObject(record.sourceRecord) ||
        !isObject(record.destinationMapping) ||
        !completeSourceRecord(record.sourceRecord) ||
        record.resolvedGrowthStage !== record.sourceRecord.growthStage ||
        !V1_SHA256_DIGEST_PATTERN.test(
          record.destinationMapping.recordDigest,
        ),
    )
  ) {
    return { valid: false, reason: "snapshot_records_incomplete" };
  }
  const identities = snapshot.records.map(
    (record) => record.sourceRecord.legacyId,
  );
  if (new Set(identities).size !== identities.length) {
    return { valid: false, reason: "snapshot_records_incomplete" };
  }
  if (
    !doesV1GrowthStageApplicabilityPolicyPass(
      snapshot.validationPolicy,
      snapshot.records.map((record) => record.sourceRecord),
    ) ||
    snapshot.metadata.nullableLakeGrowthStage.recordCount !==
      snapshot.records.filter(
        (record) =>
          record.sourceRecord.region === "Lake" &&
          record.sourceRecord.contentType === "Reflection" &&
          record.sourceRecord.growthStage === null,
      ).length ||
    snapshot.metadata.nullableLakeGrowthStage.meaning !==
      "not growth-tracked / not applicable" ||
    snapshot.metadata.nullableLakeGrowthStage.resolutionRequired !== false
  ) {
    return { valid: false, reason: "snapshot_applicability_mismatch" };
  }
  if (
    snapshot.resolution.validationStatus !== "Valid" ||
    snapshot.resolution.growthStages.some(
      (record) =>
        record.approvalStatus !== "Approved" || record.growthStage === null,
    )
  ) {
    return { valid: false, reason: "snapshot_resolution_incomplete" };
  }
  return { valid: true };
}

export function validateV1ApprovedMigrationSnapshot(
  snapshot: V1ApprovedMigrationSnapshot,
  currentPreview: V1MigrationPreview,
): V1ApprovedMigrationSnapshotValidation {
  const structure = validateSnapshotStructure(snapshot);
  if (!structure.valid) return structure;
  if (!currentPreview.readiness.importReady) {
    return { valid: false, reason: "preview_not_import_ready" };
  }
  if (
    !currentPreview.readiness.schemaCompatible ||
    snapshot.digests.schemaDigest !== currentPreview.schemaDigest
  ) {
    return { valid: false, reason: "schema_state_changed" };
  }
  if (
    !currentPreview.readiness.applicabilityPassed ||
    stableV1MigrationJson(snapshot.validationPolicy) !==
      stableV1MigrationJson(currentPreview.validationPolicy)
  ) {
    return { valid: false, reason: "validation_policy_changed" };
  }
  if (snapshot.schemaVersion !== currentPreview.schemaVersion) {
    return { valid: false, reason: "snapshot_schema_mismatch" };
  }
  if (
    snapshot.digests.resolutionDigest !==
    currentPreview.resolutionReport.resolutionDigest
  ) {
    return { valid: false, reason: "resolution_state_changed" };
  }
  if (snapshot.digests.sourceDigest !== currentPreview.sourceDigest) {
    return { valid: false, reason: "source_state_changed" };
  }
  if (
    snapshot.digests.destinationStateDigest !==
    currentPreview.destinationStateDigest
  ) {
    return { valid: false, reason: "destination_state_changed" };
  }
  if (snapshot.digests.previewDigest !== currentPreview.previewDigest) {
    return { valid: false, reason: "preview_digest_mismatch" };
  }
  if (snapshot.records.length !== currentPreview.records.length) {
    return { valid: false, reason: "snapshot_records_incomplete" };
  }
  const currentByLegacyId = new Map(
    currentPreview.records.map((record) => [
      record.sourceIdentity.legacyId,
      record,
    ]),
  );
  for (const record of snapshot.records) {
    const current = currentByLegacyId.get(record.sourceRecord.legacyId);
    if (
      !current ||
      current.recordDigest !== record.destinationMapping.recordDigest ||
      stableV1MigrationJson(current.destinationIdentity) !==
        stableV1MigrationJson(record.destinationMapping.identity)
    ) {
      return { valid: false, reason: "snapshot_record_mismatch" };
    }
  }
  return { valid: true };
}

export function parseV1ApprovedMigrationSnapshot(
  value: unknown,
): V1ApprovedMigrationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new V1ApprovedMigrationSnapshotError(
      "approved_snapshot_missing",
      "An approved migration snapshot is required.",
    );
  }
  const snapshot = value as V1ApprovedMigrationSnapshot;
  if (
    !Array.isArray(snapshot.records) ||
    !Array.isArray(snapshot.relations) ||
    !Array.isArray(snapshot.tags) ||
    !Array.isArray(snapshot.contentTags) ||
    !Array.isArray(snapshot.homeCuration) ||
    !Array.isArray(snapshot.siteCopy) ||
    !Array.isArray(snapshot.warnings) ||
    !Array.isArray(snapshot.blockers) ||
    !Array.isArray(snapshot.resolution?.growthStages) ||
    !snapshot.digests ||
    !snapshot.source ||
    !snapshot.preview ||
    !snapshot.metadata ||
    !snapshot.validationPolicy ||
    !snapshot.checks
  ) {
    throw new V1ApprovedMigrationSnapshotError(
      "incomplete_approval",
      "The approved migration snapshot is structurally incomplete.",
    );
  }
  const validation = validateSnapshotStructure(snapshot);
  if (!validation.valid) {
    throw new V1ApprovedMigrationSnapshotError(
      validation.reason,
      `The approved migration snapshot is invalid: ${validation.reason}.`,
    );
  }
  return snapshot;
}

export function serializeV1ApprovedMigrationSnapshot(
  snapshot: V1ApprovedMigrationSnapshot,
): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function formatV1ApprovedMigrationSnapshot(
  snapshot: V1ApprovedMigrationSnapshot,
): string {
  const resolved = snapshot.resolution.growthStages.filter(
    (record) => record.approvalStatus === "Approved",
  ).length;
  return [
    "Migration Approval Snapshot",
    "",
    "Status:",
    snapshot.approvalStatus === "Approved" ? "READY" : "BLOCKED",
    "",
    `Record count: ${snapshot.records.length}`,
    `Resolved records: ${resolved}`,
    `Nullable Lake Growth Stages: ${snapshot.metadata.nullableLakeGrowthStage.recordCount}`,
    `Validation policy: ${snapshot.validationPolicy.version}`,
    `Schema compatibility: ${snapshot.checks.schemaCompatible ? "passed" : "failed"}`,
    `Applicability rules: ${snapshot.checks.applicabilityPassed ? "passed" : "failed"}`,
    `Warnings: ${snapshot.warnings.length}`,
    `Blockers: ${snapshot.blockers.length}`,
    `Digest: ${snapshot.digests.snapshotDigest}`,
    `Preview digest: ${snapshot.digests.previewDigest}`,
    `Resolution digest: ${snapshot.digests.resolutionDigest}`,
    `Schema digest: ${snapshot.digests.schemaDigest}`,
  ].join("\n") + "\n";
}
