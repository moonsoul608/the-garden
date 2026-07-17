import { createHash } from "node:crypto";

import type {
  Lifecycle,
  V1ImportDestinationContent,
  V1ImportResult,
  V1MigrationPreview,
  V1MigrationPreviewRecord,
} from "../../types/content.ts";

export type V1MigrationVerificationStatus = "PASS" | "FAIL" | "WARNING";

export type V1MigrationVerificationSection =
  | "Execution"
  | "Content"
  | "Identity"
  | "Relations"
  | "Versions"
  | "Metadata"
  | "Public-read";

export type V1MigrationVerificationQueryResults = {
  schemaVersion: 1;
  kind: "v1-migration-verification-query-results";
  /** Timestamp at which this immutable, migration-scoped read snapshot was captured. */
  capturedAt: string;
  contents: V1ImportDestinationContent[];
  versions: Array<{
    id: string;
    content_id: string;
    snapshot: unknown;
    checkpoint_reason: string;
    checkpoint_note: string | null;
    created_at: string;
    created_by: string | null;
  }>;
  relations: Array<{
    id: string;
    source_content_id: string;
    target_content_id: string;
    relation_type: string;
    note_zh: string | null;
    note_en: string | null;
  }>;
  tags: Array<{
    id: string;
    normalized_name: string;
    display_name: string;
  }>;
  contentTags: Array<{
    content_id: string;
    tag_id: string;
  }>;
  growthNotes: Array<{
    id: string;
    content_id: string;
    from_stage: string | null;
    to_stage: string;
    note_zh: string | null;
    note_en: string | null;
    occurred_at: string;
    is_public: boolean;
  }>;
  /** Results collected through the existing public content service, not direct table reads. */
  publicReads: Array<{
    probeId: string;
    legacyId: string | null;
    lifecycle: Lifecycle;
    collectionVisible: boolean;
    routeDisposition: "published" | "archived" | "not_found";
  }>;
};

export type V1MigrationVerificationCheck = {
  id: string;
  section: V1MigrationVerificationSection;
  status: V1MigrationVerificationStatus;
  message: string;
  expected: unknown;
  actual: unknown;
  identities: string[];
};

export type V1MigrationVerificationReport = {
  schemaVersion: 1;
  kind: "v1-migration-verification-report";
  status: V1MigrationVerificationStatus;
  verificationDigest: string;
  timestamp: string;
  importDigest: string;
  previewDigest: string;
  sections: Array<{
    name: V1MigrationVerificationSection;
    status: V1MigrationVerificationStatus;
  }>;
  summary: {
    checksPerformed: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  checksPerformed: V1MigrationVerificationCheck[];
};

export type V1MigrationVerificationInput = {
  executionReport: V1ImportResult;
  expectedPreview: V1MigrationPreview;
  queryResults: V1MigrationVerificationQueryResults;
};

const SECTION_ORDER: readonly V1MigrationVerificationSection[] = [
  "Execution",
  "Content",
  "Identity",
  "Relations",
  "Versions",
  "Metadata",
  "Public-read",
];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en-US"))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "en-US"));
}

function sameValues(left: Iterable<string>, right: Iterable<string>): boolean {
  return stableJson(sorted(left)) === stableJson(sorted(right));
}

function statusFor(ok: boolean): V1MigrationVerificationStatus {
  return ok ? "PASS" : "FAIL";
}

function aggregateStatus(
  statuses: readonly V1MigrationVerificationStatus[],
): V1MigrationVerificationStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARNING")) return "WARNING";
  return "PASS";
}

function addCheck(
  checks: V1MigrationVerificationCheck[],
  check: Omit<V1MigrationVerificationCheck, "identities"> & {
    identities?: Iterable<string>;
  },
): void {
  checks.push({
    ...check,
    identities: sorted(check.identities ?? []),
  });
}

function countBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return Object.fromEntries(sorted(counts.keys()).map((name) => [name, counts.get(name) ?? 0]));
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function comparableContent(content: V1ImportDestinationContent): Record<string, unknown> {
  return {
    legacyId: content.legacy_id,
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
    primaryCategories: content.primary_categories,
    coverImagePath: content.cover_image_path,
    coverImageAltZh: content.cover_image_alt_zh,
    coverImageAltEn: content.cover_image_alt_en,
    featured: content.featured,
    manualOrder: content.manual_order,
    publishedAt: content.published_at,
    archivedAt: content.archived_at,
    lastTendedAt: content.last_tended_at,
  };
}

function comparableProjection(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const projection = value as Record<string, unknown>;
  const cover =
    projection.cover && typeof projection.cover === "object" && !Array.isArray(projection.cover)
      ? (projection.cover as Record<string, unknown>)
      : null;
  return {
    legacyId: projection.legacyId,
    slug: projection.slug,
    region: projection.region,
    contentType: projection.contentType,
    detailLevel: projection.detailLevel,
    lifecycle: projection.lifecycle,
    growthStage: projection.growthStage,
    titleZh: projection.titleZh,
    titleEn: projection.titleEn,
    summaryZh: projection.summaryZh,
    summaryEn: projection.summaryEn,
    bodyZhMarkdown: projection.bodyZhMarkdown,
    bodyEnMarkdown: projection.bodyEnMarkdown,
    contentLanguage: projection.contentLanguage,
    primaryCategories: projection.primaryCategories,
    coverImagePath: cover?.path ?? null,
    coverImageAltZh: cover?.altZh ?? null,
    coverImageAltEn: cover?.altEn ?? null,
    featured: projection.featured,
    manualOrder: projection.manualOrder ?? null,
    publishedAt: projection.publishedAt ?? null,
    archivedAt: projection.archivedAt ?? null,
    lastTendedAt: projection.lastTendedAt ?? null,
  };
}

function recordCore(record: V1MigrationPreviewRecord): Record<string, unknown> {
  const core: Record<string, unknown> = { ...record };
  delete core.recordDigest;
  delete core.importReady;
  return core;
}

function actualRecordDigest(
  expected: V1MigrationPreviewRecord,
  actual: V1ImportDestinationContent,
): string {
  return digest({ content: comparableContent(actual), preview: recordCore(expected) });
}

function objectValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function publicCheckStatus(
  probes: V1MigrationVerificationQueryResults["publicReads"],
  lifecycle: Lifecycle,
  compatible: (probe: V1MigrationVerificationQueryResults["publicReads"][number]) => boolean,
): V1MigrationVerificationStatus {
  const relevant = probes.filter((probe) => probe.lifecycle === lifecycle);
  if (relevant.length === 0) return "WARNING";
  return relevant.every(compatible) ? "PASS" : "FAIL";
}

export function verifyV1Migration(
  input: V1MigrationVerificationInput,
): V1MigrationVerificationReport {
  const { executionReport, expectedPreview, queryResults } = input;
  const checks: V1MigrationVerificationCheck[] = [];
  const expectedRecords = expectedPreview.records.filter((record) => record.importReady);
  const blockedRecords = expectedPreview.records.filter(
    (record) => record.validationStatus === "Blocked",
  );
  const expectedIds = new Set(
    expectedRecords.map((record) => record.sourceIdentity.legacyId),
  );
  const blockedIds = new Set(
    blockedRecords.map((record) => record.sourceIdentity.legacyId),
  );
  const actualByLegacyId = groupBy(
    queryResults.contents,
    (content) => content.legacy_id ?? "<missing-legacy-id>",
  );
  const actualByContentId = new Map(
    [...queryResults.contents]
      .sort((left, right) => left.id.localeCompare(right.id, "en-US"))
      .map((content) => [content.id, content]),
  );

  const reportIdentityMatches =
    executionReport.schemaVersion === 1 &&
    executionReport.kind === "v1-import-result" &&
    executionReport.importDigest === expectedPreview.previewDigest &&
    executionReport.sourceVersion.source === expectedPreview.source &&
    executionReport.sourceVersion.schemaVersion === 1 &&
    executionReport.verification.passed &&
    executionReport.verification.contentCount === expectedRecords.length &&
    executionReport.verification.expectedContentCount === expectedRecords.length &&
    executionReport.verification.slugUnique &&
    executionReport.verification.relationIntegrity &&
    executionReport.verification.lifecycleValid &&
    expectedPreview.readiness.importReady &&
    sameValues(executionReport.created.contents, expectedIds) &&
    executionReport.created.versions.length === expectedRecords.length &&
    executionReport.created.relations.length ===
      expectedPreview.childReadiness.relations.ready &&
    executionReport.created.tags.length === expectedPreview.childReadiness.tags.ready &&
    executionReport.created.contentTags.length ===
      expectedPreview.childReadiness.contentTags.ready &&
    executionReport.skippedRecords.length === 0;
  addCheck(checks, {
    id: "execution_report_matches_preview",
    section: "Execution",
    status: statusFor(reportIdentityMatches),
    message: reportIdentityMatches
      ? "The verified execution receipt matches the approved preview and expected identities."
      : "The execution receipt, approved preview digest/readiness, or imported identity set does not match.",
    expected: {
      importDigest: expectedPreview.previewDigest,
      source: expectedPreview.source,
      contents: sorted(expectedIds),
      skippedRecords: [],
      verificationPassed: true,
    },
    actual: {
      importDigest: executionReport.importDigest,
      source: executionReport.sourceVersion.source,
      contents: sorted(executionReport.created.contents),
      skippedRecords: sorted(executionReport.skippedRecords),
      verificationPassed: executionReport.verification.passed,
    },
  });

  const missingIds = sorted(
    [...expectedIds].filter((legacyId) => (actualByLegacyId.get(legacyId)?.length ?? 0) === 0),
  );
  const duplicateIds = sorted(
    [...actualByLegacyId]
      .filter(([legacyId, rows]) => expectedIds.has(legacyId) && rows.length > 1)
      .map(([legacyId]) => legacyId),
  );
  const unexpectedIds = sorted(
    queryResults.contents
      .map((content) => content.legacy_id ?? "<missing-legacy-id>")
      .filter((legacyId) => !expectedIds.has(legacyId)),
  );
  const actualExpectedRows = queryResults.contents.filter(
    (content) => content.legacy_id !== null && expectedIds.has(content.legacy_id),
  );

  addCheck(checks, {
    id: "content_total_count",
    section: "Content",
    status: statusFor(actualExpectedRows.length === expectedRecords.length),
    message: "Compares the expected V1 import count with migration-scoped V2 content rows.",
    expected: expectedRecords.length,
    actual: actualExpectedRows.length,
  });
  addCheck(checks, {
    id: "content_region_counts",
    section: "Content",
    status: statusFor(
      stableJson(countBy(expectedRecords, (record) => record.region)) ===
        stableJson(countBy(actualExpectedRows, (content) => content.region)),
    ),
    message: "Compares content counts by Region.",
    expected: countBy(expectedRecords, (record) => record.region),
    actual: countBy(actualExpectedRows, (content) => content.region),
  });
  addCheck(checks, {
    id: "content_type_counts",
    section: "Content",
    status: statusFor(
      stableJson(countBy(expectedRecords, (record) => record.contentType)) ===
        stableJson(countBy(actualExpectedRows, (content) => content.content_type)),
    ),
    message: "Compares content counts by Content Type.",
    expected: countBy(expectedRecords, (record) => record.contentType),
    actual: countBy(actualExpectedRows, (content) => content.content_type),
  });
  addCheck(checks, {
    id: "missing_content",
    section: "Identity",
    status: statusFor(missingIds.length === 0),
    message: missingIds.length === 0 ? "No migrated identities are missing." : "Expected migrated identities are missing.",
    expected: [],
    actual: missingIds,
    identities: missingIds,
  });
  addCheck(checks, {
    id: "duplicate_content",
    section: "Identity",
    status: statusFor(duplicateIds.length === 0),
    message: duplicateIds.length === 0 ? "No migrated source identities are duplicated." : "Duplicate V2 rows share a migrated source identity.",
    expected: [],
    actual: duplicateIds,
    identities: duplicateIds,
  });
  addCheck(checks, {
    id: "unexpected_content",
    section: "Identity",
    status: statusFor(unexpectedIds.length === 0),
    message: unexpectedIds.length === 0 ? "The migration-scoped query returned no unexpected records." : "The migration-scoped query returned unexpected records.",
    expected: [],
    actual: unexpectedIds,
    identities: unexpectedIds,
  });

  const comparablePairs = expectedRecords.flatMap((expected) => {
    const rows = actualByLegacyId.get(expected.sourceIdentity.legacyId) ?? [];
    return rows.length === 1 ? [{ expected, actual: rows[0] }] : [];
  });
  const slugMismatches = comparablePairs
    .filter(({ expected, actual }) => actual.slug !== expected.sourceIdentity.route.split("/").at(-1))
    .map(({ expected }) => expected.sourceIdentity.legacyId);
  const regionMismatches = comparablePairs
    .filter(({ expected, actual }) => actual.region !== expected.region)
    .map(({ expected }) => expected.sourceIdentity.legacyId);
  const lifecycleMismatches = comparablePairs
    .filter(({ expected, actual }) => actual.lifecycle !== expected.lifecycleTarget)
    .map(({ expected }) => expected.sourceIdentity.legacyId);
  const blockedImported = queryResults.contents
    .filter((content) => content.legacy_id !== null && blockedIds.has(content.legacy_id))
    .map((content) => content.legacy_id as string);

  for (const [id, message, identities] of [
    ["slug_preserved", "Every migrated slug matches the approved preview.", slugMismatches],
    ["region_preserved", "Every migrated Region matches the approved preview.", regionMismatches],
    ["lifecycle_preserved", "Every migrated lifecycle matches the approved target.", lifecycleMismatches],
    ["blocked_records_remain_blocked", "Blocked preview records remain absent from imported V2 content.", blockedImported],
  ] as const) {
    addCheck(checks, {
      id,
      section: "Identity",
      status: statusFor(identities.length === 0),
      message: identities.length === 0 ? message : `${message} Mismatches were detected.`,
      expected: [],
      actual: sorted(identities),
      identities,
    });
  }

  const structuredMismatches = comparablePairs
    .filter(({ expected, actual }) => actualRecordDigest(expected, actual) !== expected.recordDigest)
    .map(({ expected }) => expected.sourceIdentity.legacyId);
  const growthStageMismatches = comparablePairs
    .filter(({ expected, actual }) => actual.growth_stage !== expected.growthStage)
    .map(({ expected }) => expected.sourceIdentity.legacyId);
  addCheck(checks, {
    id: "structured_metadata",
    section: "Metadata",
    status: statusFor(structuredMismatches.length === 0),
    message: "Recomputes each approved record digest from the V2 structured fields.",
    expected: "all record digests match",
    actual: sorted(structuredMismatches),
    identities: structuredMismatches,
  });
  addCheck(checks, {
    id: "growth_stage",
    section: "Metadata",
    status: statusFor(growthStageMismatches.length === 0),
    message: "Compares every approved Growth Stage without inference.",
    expected: "approved preview Growth Stages",
    actual: sorted(growthStageMismatches),
    identities: growthStageMismatches,
  });

  const actualGrowthNoteIds = sorted(queryResults.growthNotes.map((note) => note.id));
  const expectedGrowthNoteIds = sorted(executionReport.created.growthNotes);
  const growthNoteOrphans = queryResults.growthNotes
    .filter((note) => !actualByContentId.has(note.content_id))
    .map((note) => note.id);
  const growthNotesMatch =
    sameValues(expectedGrowthNoteIds, actualGrowthNoteIds) && growthNoteOrphans.length === 0;
  addCheck(checks, {
    id: "growth_notes",
    section: "Metadata",
    status: statusFor(growthNotesMatch),
    message: expectedGrowthNoteIds.length === 0
      ? "V1 has no structured Growth Notes; no rows were invented (Markdown Growth notes remain in the body digest)."
      : "Structured Growth Note identities and targets match the execution report.",
    expected: expectedGrowthNoteIds,
    actual: actualGrowthNoteIds,
    identities: growthNoteOrphans,
  });

  const tagById = new Map(queryResults.tags.map((tag) => [tag.id, tag]));
  const expectedTags = sorted(executionReport.created.tags);
  const actualTags = sorted(queryResults.tags.map((tag) => tag.normalized_name));
  const contentTagOrphans: string[] = [];
  const actualContentTags = queryResults.contentTags.flatMap((binding) => {
    const content = actualByContentId.get(binding.content_id);
    const tag = tagById.get(binding.tag_id);
    if (!content?.legacy_id || !tag) {
      contentTagOrphans.push(`${binding.content_id}:${binding.tag_id}`);
      return [];
    }
    return [`${content.legacy_id}:${tag.normalized_name}`];
  });
  const expectedContentTags = sorted(executionReport.created.contentTags);
  const tagsMatch =
    sameValues(expectedTags, actualTags) &&
    sameValues(expectedContentTags, actualContentTags) &&
    contentTagOrphans.length === 0;
  addCheck(checks, {
    id: "tags",
    section: "Metadata",
    status: statusFor(tagsMatch),
    message: "Compares migration-scoped tags and content-tag bindings without adding metadata.",
    expected: { tags: expectedTags, contentTags: expectedContentTags },
    actual: { tags: actualTags, contentTags: sorted(actualContentTags) },
    identities: contentTagOrphans,
  });

  const expectedWarningCodes = sorted(
    expectedPreview.warnings.map((warning) => warning.code),
  );
  const actualWarningCodes = sorted(
    executionReport.warnings.map((warning) => warning.code),
  );
  const warningSetsMatch = sameValues(expectedWarningCodes, actualWarningCodes);
  addCheck(checks, {
    id: "compatibility_warnings",
    section: "Metadata",
    status: !warningSetsMatch
      ? "FAIL"
      : executionReport.warnings.length > 0
        ? "WARNING"
        : "PASS",
    message: !warningSetsMatch
      ? "The execution receipt did not preserve the approved compatibility warning set."
      : executionReport.warnings.length > 0
        ? "Approved compatibility warnings remain deferred and were not converted into invented values."
        : "No compatibility warnings were reported.",
    expected: expectedWarningCodes,
    actual: actualWarningCodes,
    identities: executionReport.warnings.map((warning) => warning.code),
  });

  const versionByContentId = groupBy(queryResults.versions, (version) => version.content_id);
  const invalidVersionCounts: string[] = [];
  const invalidSnapshots: string[] = [];
  const invalidProvenance: string[] = [];
  const actualInitialVersionIds: string[] = [];
  for (const { expected, actual } of comparablePairs) {
    const versions = (versionByContentId.get(actual.id) ?? []).filter((version) => {
      const migration = objectValue(version.snapshot, "migration");
      return (
        version.checkpoint_reason === "V1 import" ||
        objectValue(migration, "importDigest") === executionReport.importDigest ||
        executionReport.created.versions.includes(version.id)
      );
    });
    const validInitial = versions.filter(
      (version) =>
        version.checkpoint_reason === "V1 import" &&
        objectValue(objectValue(version.snapshot, "migration"), "importDigest") === executionReport.importDigest,
    );
    actualInitialVersionIds.push(...validInitial.map((version) => version.id));
    if (validInitial.length !== 1) {
      invalidVersionCounts.push(expected.sourceIdentity.legacyId);
      continue;
    }
    const [version] = validInitial;
    const projection = comparableProjection(objectValue(version.snapshot, "projection"));
    const snapshotCollectionsExist =
      Array.isArray(objectValue(version.snapshot, "tags")) &&
      Array.isArray(objectValue(version.snapshot, "relations")) &&
      Array.isArray(objectValue(version.snapshot, "growthNotes")) &&
      version.snapshot !== null &&
      typeof version.snapshot === "object" &&
      !Array.isArray(version.snapshot) &&
      Object.hasOwn(version.snapshot, "cover");
    if (
      !projection ||
      !snapshotCollectionsExist ||
      stableJson(projection) !== stableJson(comparableContent(actual)) ||
      version.checkpoint_note !== "Initial immutable V1 migration checkpoint."
    ) {
      invalidSnapshots.push(expected.sourceIdentity.legacyId);
    }
    const migration = objectValue(version.snapshot, "migration");
    const provenanceMatches =
      objectValue(migration, "source") === "v1-static-typescript" &&
      objectValue(migration, "sourceVersion") === 1 &&
      objectValue(migration, "legacyId") === expected.sourceIdentity.legacyId &&
      objectValue(migration, "importDigest") === executionReport.importDigest &&
      objectValue(migration, "sourceDigest") === expectedPreview.sourceDigest &&
      stableJson(objectValue(migration, "growthStageResolution") ?? null) ===
        stableJson(expected.growthStageResolution);
    if (!provenanceMatches) invalidProvenance.push(expected.sourceIdentity.legacyId);
  }
  const versionIdentityMismatch = !sameValues(
    executionReport.created.versions,
    actualInitialVersionIds,
  );
  addCheck(checks, {
    id: "initial_version_count",
    section: "Versions",
    status: statusFor(invalidVersionCounts.length === 0 && !versionIdentityMismatch),
    message: "Requires exactly one initial V1 import version per migrated content identity.",
    expected: sorted(executionReport.created.versions),
    actual: sorted(actualInitialVersionIds),
    identities: invalidVersionCounts,
  });
  addCheck(checks, {
    id: "immutable_version_snapshot",
    section: "Versions",
    status: statusFor(invalidSnapshots.length === 0),
    message: "Requires an immutable initial checkpoint snapshot matching the imported projection.",
    expected: [],
    actual: sorted(invalidSnapshots),
    identities: invalidSnapshots,
  });
  addCheck(checks, {
    id: "version_provenance",
    section: "Versions",
    status: statusFor(invalidProvenance.length === 0),
    message: "Requires source, source version, legacy identity, digests, and Growth Stage approval provenance.",
    expected: [],
    actual: sorted(invalidProvenance),
    identities: invalidProvenance,
  });

  const relationOrphans: string[] = [];
  const invalidRelationLifecycles: string[] = [];
  const actualRelationIdentities = queryResults.relations.flatMap((relation) => {
    const source = actualByContentId.get(relation.source_content_id);
    const target = actualByContentId.get(relation.target_content_id);
    if (!source?.legacy_id || !target?.legacy_id) {
      relationOrphans.push(relation.id);
      return [];
    }
    const identity = `${source.legacy_id}:${target.legacy_id}:${relation.relation_type}`;
    if (source.lifecycle !== "Published" || target.lifecycle !== "Published") {
      invalidRelationLifecycles.push(identity);
    }
    return [identity];
  });
  const expectedRelations = sorted(executionReport.created.relations);
  const relationIdentityMatches = sameValues(expectedRelations, actualRelationIdentities);
  addCheck(checks, {
    id: "relation_count",
    section: "Relations",
    status: statusFor(queryResults.relations.length === expectedRelations.length),
    message: "Compares the expected and actual migration relation counts.",
    expected: expectedRelations.length,
    actual: queryResults.relations.length,
  });
  addCheck(checks, {
    id: "relation_targets",
    section: "Relations",
    status: statusFor(relationIdentityMatches),
    message: "Compares source identity, target identity, and relation type.",
    expected: expectedRelations,
    actual: sorted(actualRelationIdentities),
    identities: relationIdentityMatches ? [] : actualRelationIdentities,
  });
  addCheck(checks, {
    id: "relation_orphans",
    section: "Relations",
    status: statusFor(relationOrphans.length === 0),
    message: "Requires every relation source and target to resolve in the migration-scoped content snapshot.",
    expected: [],
    actual: sorted(relationOrphans),
    identities: relationOrphans,
  });
  addCheck(checks, {
    id: "relation_lifecycle",
    section: "Relations",
    status: statusFor(invalidRelationLifecycles.length === 0),
    message: "Requires migrated public relation endpoints to remain Published.",
    expected: [],
    actual: sorted(invalidRelationLifecycles),
    identities: invalidRelationLifecycles,
  });

  const publishedProbeByLegacyId = groupBy(
    queryResults.publicReads.filter((probe) => probe.lifecycle === "Published"),
    (probe) => probe.legacyId ?? `<probe:${probe.probeId}>`,
  );
  const invalidPublishedReads = sorted(
    [...expectedIds].filter((legacyId) => {
      const probes = publishedProbeByLegacyId.get(legacyId) ?? [];
      return (
        probes.length !== 1 ||
        !probes[0].collectionVisible ||
        probes[0].routeDisposition !== "published"
      );
    }),
  );
  addCheck(checks, {
    id: "published_service_reads",
    section: "Public-read",
    status: statusFor(invalidPublishedReads.length === 0),
    message: "Checks the unchanged public service can list and resolve every migrated Published record.",
    expected: [],
    actual: invalidPublishedReads,
    identities: invalidPublishedReads,
  });

  for (const lifecycle of ["Archived", "Draft", "Review"] as const) {
    const compatible = lifecycle === "Archived"
      ? (probe: V1MigrationVerificationQueryResults["publicReads"][number]) =>
          !probe.collectionVisible && probe.routeDisposition === "archived"
      : (probe: V1MigrationVerificationQueryResults["publicReads"][number]) =>
          !probe.collectionVisible && probe.routeDisposition === "not_found";
    const status = publicCheckStatus(queryResults.publicReads, lifecycle, compatible);
    const probes = queryResults.publicReads.filter((probe) => probe.lifecycle === lifecycle);
    const invalid = probes.filter((probe) => !compatible(probe)).map((probe) => probe.probeId);
    addCheck(checks, {
      id: `${lifecycle.toLowerCase()}_public_behavior`,
      section: "Public-read",
      status,
      message: status === "WARNING"
        ? `No ${lifecycle} control probe was supplied; compatibility could not be observed.`
        : `${lifecycle} collection and route behavior matches the existing public service contract.`,
      expected: lifecycle === "Archived"
        ? { collectionVisible: false, routeDisposition: "archived" }
        : { collectionVisible: false, routeDisposition: "not_found" },
      actual: [...probes]
        .sort((left, right) => left.probeId.localeCompare(right.probeId, "en-US"))
        .map((probe) => ({
          probeId: probe.probeId,
          collectionVisible: probe.collectionVisible,
          routeDisposition: probe.routeDisposition,
        })),
      identities: invalid,
    });
  }

  const sections = SECTION_ORDER.map((name) => ({
    name,
    status: aggregateStatus(
      checks.filter((check) => check.section === name).map((check) => check.status),
    ),
  }));
  const summary = {
    checksPerformed: checks.length,
    passed: checks.filter((check) => check.status === "PASS").length,
    failed: checks.filter((check) => check.status === "FAIL").length,
    warnings: checks.filter((check) => check.status === "WARNING").length,
  };
  const reportCore = {
    schemaVersion: 1 as const,
    kind: "v1-migration-verification-report" as const,
    status: aggregateStatus(sections.map((section) => section.status)),
    timestamp: queryResults.capturedAt,
    importDigest: executionReport.importDigest,
    previewDigest: expectedPreview.previewDigest,
    sections,
    summary,
    checksPerformed: checks,
  };

  return {
    ...reportCore,
    verificationDigest: digest(reportCore),
  };
}

export function formatV1MigrationVerificationReport(
  report: V1MigrationVerificationReport,
): string {
  const lines = ["Migration Verification", "", `Overall: ${report.status}`, ""];
  for (const section of report.sections) {
    lines.push(`${section.name}:`, section.status, "");
  }
  lines.push(
    `Verification digest: ${report.verificationDigest}`,
    `Timestamp: ${report.timestamp}`,
    `Checks performed: ${report.summary.checksPerformed}`,
  );

  const findings = report.checksPerformed.filter((check) => check.status !== "PASS");
  if (findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of findings) {
      lines.push(`- ${finding.status} ${finding.id}: ${finding.message}`);
      for (const identity of finding.identities) lines.push(`  - ${identity}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function serializeV1MigrationVerificationReport(
  report: V1MigrationVerificationReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
