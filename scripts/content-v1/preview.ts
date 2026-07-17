import { createHash } from "node:crypto";

import type {
  V1ApprovedPreviewSnapshot,
  V1MigrationContentRecord,
  V1MigrationIssue,
  V1MigrationPlannedOperation,
  V1MigrationPreview,
  V1MigrationPreviewBlocker,
  V1MigrationPreviewRecord,
  V1MigrationPreviewWarning,
} from "../../types/content.ts";

import {
  extractV1Content,
  type V1ExtractManifest,
} from "./extract.ts";
import { transformV1Content } from "./transform.ts";
import { verifyV1MigrationBundle } from "./verify.ts";

export type V1ExistingContent = Record<string, unknown>;

export type V1MigrationPreviewOptions = {
  extract?: V1ExtractManifest;
  existingContents?: readonly V1ExistingContent[];
  environment?: "none" | "preview";
  safeguardFailures?: readonly {
    code: string;
    legacyId: string | null;
    message: string;
  }[];
};

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

function existingField(
  content: V1ExistingContent,
  camel: string,
  snake: string,
): unknown {
  return content[camel] !== undefined ? content[camel] : content[snake];
}

function stringField(
  content: V1ExistingContent,
  camel: string,
  snake: string,
): string | null {
  const value = existingField(content, camel, snake);
  return typeof value === "string" ? value : null;
}

function existingLegacyId(content: V1ExistingContent): string | null {
  return stringField(content, "legacyId", "legacy_id");
}

function existingContentId(content: V1ExistingContent): string | null {
  return typeof content.id === "string" ? content.id : null;
}

function routeKey(region: unknown, slug: unknown): string | null {
  return typeof region === "string" && typeof slug === "string"
    ? `${region}/${slug}`
    : null;
}

function comparableCandidate(
  content: V1MigrationContentRecord,
): Record<string, unknown> {
  return {
    legacyId: content.legacyId,
    slug: content.slug,
    region: content.region,
    contentType: content.contentType,
    detailLevel: content.detailLevel,
    lifecycle: content.lifecycle,
    growthStage: content.growthStage,
    titleZh: content.titleZh,
    titleEn: content.titleEn,
    summaryZh: content.summaryZh,
    summaryEn: content.summaryEn,
    bodyZhMarkdown: content.bodyZhMarkdown,
    bodyEnMarkdown: content.bodyEnMarkdown,
    contentLanguage: content.contentLanguage,
    primaryCategories: content.primaryCategories,
    coverImagePath: content.cover?.path ?? null,
    coverImageAltZh: content.cover?.altZh ?? null,
    coverImageAltEn: content.cover?.altEn ?? null,
    featured: content.featured,
    manualOrder: content.manualOrder,
    publishedAt: content.publishedAt,
    archivedAt: content.archivedAt,
    lastTendedAt: content.lastTendedAt,
  };
}

function comparableExisting(content: V1ExistingContent): Record<string, unknown> {
  return {
    legacyId: existingField(content, "legacyId", "legacy_id"),
    slug: content.slug,
    region: content.region,
    contentType: existingField(content, "contentType", "content_type"),
    detailLevel: existingField(content, "detailLevel", "detail_level"),
    lifecycle: content.lifecycle,
    growthStage: existingField(content, "growthStage", "growth_stage"),
    titleZh: existingField(content, "titleZh", "title_zh"),
    titleEn: existingField(content, "titleEn", "title_en"),
    summaryZh: existingField(content, "summaryZh", "summary_zh"),
    summaryEn: existingField(content, "summaryEn", "summary_en"),
    bodyZhMarkdown: existingField(content, "bodyZhMarkdown", "body_zh_markdown"),
    bodyEnMarkdown: existingField(content, "bodyEnMarkdown", "body_en_markdown"),
    contentLanguage: existingField(content, "contentLanguage", "content_language"),
    primaryCategories: existingField(content, "primaryCategories", "primary_categories"),
    coverImagePath: existingField(content, "coverImagePath", "cover_image_path") ?? null,
    coverImageAltZh: existingField(content, "coverImageAltZh", "cover_image_alt_zh") ?? null,
    coverImageAltEn: existingField(content, "coverImageAltEn", "cover_image_alt_en") ?? null,
    featured: content.featured,
    manualOrder: existingField(content, "manualOrder", "manual_order") ?? null,
    publishedAt: existingField(content, "publishedAt", "published_at") ?? null,
    archivedAt: existingField(content, "archivedAt", "archived_at") ?? null,
    lastTendedAt: existingField(content, "lastTendedAt", "last_tended_at") ?? null,
  };
}

function blockerGuidance(field: string): {
  whyRequired: string;
  manualAction: string;
} {
  switch (field) {
    case "growthStage":
      return {
        whyRequired: "Every V2 content record and every Published candidate requires a manually assigned Growth Stage.",
        manualAction: "The Garden Keeper must choose and approve Seed, Sprout, Growing, Bloom, or Dormant, then regenerate the preview.",
      };
    case "slug":
      return {
        whyRequired: "A unique Region and slug pair is required to preserve one stable public route.",
        manualAction: "Review the source and destination route owners, resolve the conflict manually, then regenerate the preview.",
      };
    case "lifecycle":
      return {
        whyRequired: "A legacy public record may target Published only when it does not overwrite incompatible Draft, Review, or Archived state.",
        manualAction: "Review the existing destination lifecycle and decide the correct migration handling before regenerating the preview.",
      };
    case "publishedAt":
      return {
        whyRequired: "The V2 publication contract requires a publication timestamp, while migration policy forbids inventing a historical date.",
        manualAction: "Approve a migration-specific nullable legacy timestamp rule or provide confirmed source dates, then regenerate the preview.",
      };
    case "relation":
    case "sourceLegacyId":
    case "targetLegacyId":
    case "relationType":
      return {
        whyRequired: "Every child relation requires unique, supported, ready source and target records.",
        manualAction: "Resolve the named relation endpoint or duplicate manually; do not create or infer a replacement relation.",
      };
    case "legacyId":
      return {
        whyRequired: "contents.legacy_id is the stable idempotency key and must identify exactly one destination record.",
        manualAction: "Resolve the duplicate source or destination identity manually, then regenerate the preview.",
      };
    case "title":
    case "summary":
    case "bodyMarkdown":
    case "primaryCategories":
    case "cover":
      return {
        whyRequired: `The V2 publication contract requires the ${field} field before content can target Published.`,
        manualAction: `Provide and approve the missing ${field} value in the migration source, then regenerate the preview.`,
      };
    default:
      return {
        whyRequired: `The ${field} field is required by the verified V2 migration or publication contract.`,
        manualAction: `Review and correct ${field} manually in the approved source or destination snapshot, then regenerate the preview.`,
      };
  }
}

function toBlocker(issue: V1MigrationIssue): V1MigrationPreviewBlocker {
  const field = issue.field ?? "record";
  return {
    code: issue.code,
    field,
    message: issue.message,
    ...blockerGuidance(field),
  };
}

function makeBlocker(
  code: string,
  field: string,
  message: string,
): V1MigrationPreviewBlocker {
  return { code, field, message, ...blockerGuidance(field) };
}

function addBlocker(
  blockers: V1MigrationPreviewBlocker[],
  blocker: V1MigrationPreviewBlocker,
): void {
  const duplicate = blockers.some(
    (current) =>
      current.code === blocker.code &&
      current.field === blocker.field &&
      current.message === blocker.message,
  );
  if (!duplicate) blockers.push(blocker);
}

function deterministicRecordId(legacyId: string): string {
  return digest(`v1-static-typescript:${legacyId}`);
}

function deterministicDestinationId(legacyId: string): string {
  return `contents:legacy_id:${legacyId}`;
}

export function buildV1MigrationPreview(
  options: V1MigrationPreviewOptions = {},
): V1MigrationPreview {
  const extract = options.extract ?? extractV1Content();
  const bundle = transformV1Content(extract);
  const verification = verifyV1MigrationBundle(bundle);
  const existingContents = [...(options.existingContents ?? [])];
  const sourceDigest = digest(extract);
  const destinationStateDigest = digest(
    existingContents.map((content) => stableJson(content)).sort(),
  );

  const existingByLegacyId = new Map<string, V1ExistingContent[]>();
  const existingByRoute = new Map<string, V1ExistingContent[]>();
  for (const existing of existingContents) {
    const legacyId = existingLegacyId(existing);
    if (legacyId) {
      existingByLegacyId.set(legacyId, [
        ...(existingByLegacyId.get(legacyId) ?? []),
        existing,
      ]);
    }
    const route = routeKey(existing.region, existing.slug);
    if (route) {
      existingByRoute.set(route, [...(existingByRoute.get(route) ?? []), existing]);
    }
  }

  const warningModels: V1MigrationPreviewWarning[] =
    bundle.compatibilityWarnings.map((warning) => ({
      code: warning.code,
      field: null,
      message: warning.message,
    }));
  const globalBlockers = verification.blocked
    .filter((issue) => issue.legacyId === null)
    .map(toBlocker);
  if (
    bundle.contents.some(
      (content) => content.lifecycle === "Published" && !content.publishedAt,
    )
  ) {
    addBlocker(
      globalBlockers,
      makeBlocker(
        "publication_timestamp_policy_unresolved",
        "publishedAt",
        "Legacy Published candidates have no confirmed publication timestamps and no approved migration-specific nullable timestamp rule.",
      ),
    );
  }

  const records: V1MigrationPreviewRecord[] = bundle.contents.map((content) => {
    const matches = existingByLegacyId.get(content.legacyId) ?? [];
    const current = matches[0] ?? null;
    const route = `${content.region}/${content.slug}`;
    const routeOwners = existingByRoute.get(route) ?? [];
    const blockers = verification.blocked
      .filter((issue) => issue.legacyId === content.legacyId)
      .map(toBlocker);

    if (matches.length > 1) {
      addBlocker(
        blockers,
        makeBlocker(
          "duplicate_existing_legacy_id",
          "legacyId",
          `The destination snapshot contains ${matches.length} records with contents.legacy_id ${content.legacyId}.`,
        ),
      );
    }

    const conflictingRouteOwners = routeOwners.filter(
      (owner) => existingLegacyId(owner) !== content.legacyId,
    );
    if (conflictingRouteOwners.length > 0) {
      addBlocker(
        blockers,
        makeBlocker(
          "destination_slug_conflict",
          "slug",
          `Destination route ${route} is already owned by a different or missing legacy_id.`,
        ),
      );
    }

    if (current && current.lifecycle !== "Published") {
      addBlocker(
        blockers,
        makeBlocker(
          "incompatible_destination_lifecycle",
          "lifecycle",
          `Existing contents.legacy_id ${content.legacyId} has lifecycle ${String(current.lifecycle)}; preview will not overwrite it as Published.`,
        ),
      );
    }

    const warnings = bundle.compatibilityWarnings
      .filter((warning) => warning.legacyId === content.legacyId)
      .map((warning) => ({
        code: warning.code,
        field: null,
        message: warning.message,
      }));

    let plannedOperation: V1MigrationPlannedOperation = "None";
    if (blockers.length === 0) {
      if (!current) plannedOperation = "Create";
      else if (
        stableJson(comparableCandidate(content)) ===
        stableJson(comparableExisting(current))
      ) {
        plannedOperation = "Unchanged";
      } else {
        plannedOperation = "Update";
      }
    }

    return {
      previewRecordId: deterministicRecordId(content.legacyId),
      sourceIdentity: {
        source: "v1-static-typescript",
        legacyId: content.legacyId,
        route: `/${content.region.toLowerCase()}/${content.slug}`,
      },
      destinationIdentity: {
        collection: "contents",
        keyField: "legacy_id",
        keyValue: content.legacyId,
        deterministicId: deterministicDestinationId(content.legacyId),
        existingContentId: current ? existingContentId(current) : null,
        exists: Boolean(current),
        route: `/${content.region.toLowerCase()}/${content.slug}`,
      },
      region: content.region,
      contentType: content.contentType,
      lifecycleTarget: content.lifecycle,
      plannedOperation,
      validationStatus:
        blockers.length > 0
          ? "Blocked"
          : warnings.length > 0
            ? "Warning"
            : "Ready",
      blockers,
      warnings,
    };
  });

  const recordByLegacyId = new Map(
    records.map((record) => [record.sourceIdentity.legacyId, record]),
  );
  const relationKeys = new Set<string>();
  let blockedRelations = 0;
  let duplicateRelations = 0;
  const blockedRelationItems: V1MigrationPreview["childReadiness"]["relations"]["blockedItems"] = [];
  for (const relation of bundle.relations) {
    const key = `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`;
    const source = recordByLegacyId.get(relation.sourceLegacyId);
    const target = recordByLegacyId.get(relation.targetLegacyId);
    const duplicate = relationKeys.has(key);
    relationKeys.add(key);
    if (duplicate) duplicateRelations += 1;
    if (!source || !target || duplicate || target.blockers.length > 0) {
      blockedRelations += 1;
      const message = duplicate
        ? `Relation ${key} is duplicated.`
        : !source || !target
          ? `Relation ${key} has an unresolved endpoint.`
          : `Relation ${key} is waiting for a blocked endpoint record.`;
      blockedRelationItems.push({
        identity: key,
        blockers: [
          makeBlocker(
            duplicate ? "duplicate_relation" : "child_relation_not_ready",
            "relation",
            message,
          ),
        ],
      });
    }
  }

  const tagNames = new Set<string>();
  let blockedTags = 0;
  let duplicateTags = 0;
  const blockedTagItems: V1MigrationPreview["childReadiness"]["tags"]["blockedItems"] = [];
  for (const tag of bundle.tags) {
    const invalid = !tag.normalizedName || !tag.displayName.trim();
    const duplicate = tagNames.has(tag.normalizedName);
    if (duplicate) duplicateTags += 1;
    if (invalid || duplicate) {
      blockedTags += 1;
      blockedTagItems.push({
        identity: tag.normalizedName,
        blockers: [
          makeBlocker(
            duplicate ? "duplicate_tag" : "invalid_tag",
            "tags",
            duplicate
              ? `Tag ${tag.normalizedName} is duplicated.`
              : "A tag child is missing its normalized or display name.",
          ),
        ],
      });
    }
    tagNames.add(tag.normalizedName);
  }

  const contentTagKeys = new Set<string>();
  let blockedContentTags = 0;
  let duplicateContentTags = 0;
  const blockedContentTagItems: V1MigrationPreview["childReadiness"]["contentTags"]["blockedItems"] = [];
  for (const contentTag of bundle.contentTags) {
    const key = `${contentTag.contentLegacyId}:${contentTag.tagNormalizedName}`;
    const duplicate = contentTagKeys.has(key);
    if (duplicate) duplicateContentTags += 1;
    contentTagKeys.add(key);
    const content = recordByLegacyId.get(contentTag.contentLegacyId);
    if (
      duplicate ||
      !content ||
      content.blockers.length > 0 ||
      !tagNames.has(contentTag.tagNormalizedName)
    ) {
      blockedContentTags += 1;
      blockedContentTagItems.push({
        identity: key,
        blockers: [
          makeBlocker(
            duplicate ? "duplicate_content_tag" : "child_content_tag_not_ready",
            "tags",
            duplicate
              ? `Content-tag child ${key} is duplicated.`
              : `Content-tag child ${key} is waiting for ready content and tag identities.`,
          ),
        ],
      });
    }
  }

  const failures = [
    ...verification.failed,
    ...(options.safeguardFailures ?? []),
  ];
  const summary: V1MigrationPreview["summary"] = {
    total: records.length,
    ready: records.filter((record) => record.validationStatus !== "Blocked").length,
    blocked: records.filter((record) => record.validationStatus === "Blocked").length,
    warningRecords: records.filter((record) => record.validationStatus === "Warning").length,
    warnings: warningModels.length,
    create: records.filter((record) => record.plannedOperation === "Create").length,
    update: records.filter((record) => record.plannedOperation === "Update").length,
    unchanged: records.filter((record) => record.plannedOperation === "Unchanged").length,
    noOperation: records.filter((record) => record.plannedOperation === "None").length,
    existing: records.filter((record) => record.destinationIdentity.exists).length,
    duplicateConflicts: records.filter((record) =>
      record.blockers.some((blocker) => blocker.code.includes("duplicate")),
    ).length,
  };

  const previewCore = {
    schemaVersion: 1 as const,
    kind: "v1-import-preview" as const,
    environment: options.environment ?? "none",
    status:
      summary.blocked > 0 || globalBlockers.length > 0 || failures.length > 0
        ? ("Blocked" as const)
        : warningModels.length > 0
          ? ("Warning" as const)
          : ("Ready" as const),
    source: "v1-static-typescript" as const,
    sourceDigest,
    destinationStateDigest,
    records,
    blockers: globalBlockers,
    warnings: warningModels,
    failures,
    childReadiness: {
      relations: {
        ready: bundle.relations.length - blockedRelations,
        blocked: blockedRelations,
        duplicates: duplicateRelations,
        blockedItems: blockedRelationItems,
      },
      tags: {
        ready: bundle.tags.length - blockedTags,
        blocked: blockedTags,
        duplicates: duplicateTags,
        blockedItems: blockedTagItems,
      },
      contentTags: {
        ready: bundle.contentTags.length - blockedContentTags,
        blocked: blockedContentTags,
        duplicates: duplicateContentTags,
        blockedItems: blockedContentTagItems,
      },
    },
    summary,
  };
  const previewDigest = digest(previewCore);

  return {
    ...previewCore,
    previewDigest,
    approval: {
      approvedPreviewSnapshotRequired: true,
      matchingDigestRequired: true,
      unchangedSourceStateRequired: true,
      unchangedDestinationStateRequired: true,
      previewDigest,
      sourceDigest,
      destinationStateDigest,
    },
  };
}

export function validateV1ApprovedPreviewSnapshot(
  approved: V1ApprovedPreviewSnapshot,
  current: V1MigrationPreview,
): { valid: true } | { valid: false; reason: string } {
  if ((approved as { approved?: unknown }).approved !== true) {
    return { valid: false, reason: "preview_not_approved" };
  }
  if (approved.sourceDigest !== current.sourceDigest) {
    return { valid: false, reason: "source_state_changed" };
  }
  if (approved.destinationStateDigest !== current.destinationStateDigest) {
    return { valid: false, reason: "destination_state_changed" };
  }
  if (approved.previewDigest !== current.previewDigest) {
    return { valid: false, reason: "preview_digest_mismatch" };
  }
  return { valid: true };
}

export function serializeV1MigrationPreview(
  preview: V1MigrationPreview,
): string {
  return `${JSON.stringify(preview, null, 2)}\n`;
}

export function formatV1MigrationPreview(
  preview: V1MigrationPreview,
): string {
  const lines = [
    "Migration Preview:",
    "",
    "Ready:",
    String(preview.summary.ready),
    "",
    "Blocked:",
    String(preview.summary.blocked),
    "",
    "Warnings:",
    String(preview.summary.warnings),
    "",
    `Planned operations: ${preview.summary.create} create, ${preview.summary.update} update, ${preview.summary.unchanged} unchanged, ${preview.summary.noOperation} none.`,
    `Approval digest: ${preview.previewDigest}`,
  ];

  for (const record of preview.records.filter((item) => item.blockers.length > 0)) {
    lines.push("", `Blocked record: ${record.sourceIdentity.legacyId}`);
    for (const blocker of record.blockers) {
      lines.push(
        `- Missing/conflicting field: ${blocker.field}`,
        `  Why required: ${blocker.whyRequired}`,
        `  Manual action: ${blocker.manualAction}`,
      );
    }
  }

  for (const blocker of preview.blockers) {
    lines.push(
      "",
      `Global blocker: ${blocker.field}`,
      `- Why required: ${blocker.whyRequired}`,
      `  Manual action: ${blocker.manualAction}`,
    );
  }

  for (const [kind, readiness] of Object.entries(preview.childReadiness)) {
    for (const child of readiness.blockedItems) {
      lines.push("", `Blocked child ${kind}: ${child.identity}`);
      for (const blocker of child.blockers) {
        lines.push(
          `- Field: ${blocker.field}`,
          `  Why required: ${blocker.whyRequired}`,
          `  Manual action: ${blocker.manualAction}`,
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
