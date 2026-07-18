import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  RegionName,
  V1MigrationBundle,
  V1MigrationCompatibilityWarning,
  V1MigrationIssue,
} from "../../types/content.ts";
import {
  requiresGrowthStage,
  validateV1MigrationBundle,
} from "../../lib/content/validation.ts";

import { transformV1Content } from "./transform.ts";

const EXPECTED_TOTAL = 19;
const EXPECTED_REGION_COUNTS: Record<RegionName, number> = {
  Garden: 5,
  Forest: 5,
  Lake: 5,
  Ruins: 4,
};

export type V1VerificationFailure = {
  code: string;
  legacyId: string | null;
  message: string;
};

export type V1VerificationReport = {
  schemaVersion: 1;
  status: "passed" | "failed";
  migrationStatus: V1MigrationBundle["status"];
  counts: {
    total: number;
    regions: Record<RegionName, number>;
    relations: number;
    importable: number;
    blocked: number;
  };
  blockedContentExcluded: boolean;
  importableLegacyIds: string[];
  blocked: V1MigrationIssue[];
  failed: V1VerificationFailure[];
  warnings: V1MigrationCompatibilityWarning[];
};

function failure(
  failed: V1VerificationFailure[],
  code: string,
  message: string,
  legacyId: string | null = null,
): void {
  failed.push({ code, legacyId, message });
}

export function verifyV1MigrationBundle(
  bundle: V1MigrationBundle = transformV1Content(),
): V1VerificationReport {
  const failed: V1VerificationFailure[] = [];
  const regionCounts: Record<RegionName, number> = {
    Garden: 0,
    Forest: 0,
    Lake: 0,
    Ruins: 0,
  };
  const legacyIds = new Set<string>();
  const routes = new Set<string>();

  if (bundle.contents.length !== EXPECTED_TOTAL) {
    failure(
      failed,
      "unexpected_record_count",
      `Expected exactly ${EXPECTED_TOTAL} records; found ${bundle.contents.length}.`,
    );
  }

  for (const content of bundle.contents) {
    regionCounts[content.region] += 1;
    if (legacyIds.has(content.legacyId)) {
      failure(
        failed,
        "duplicate_legacy_id",
        `Duplicate legacy_id: ${content.legacyId}.`,
        content.legacyId,
      );
    }
    legacyIds.add(content.legacyId);

    const route = `${content.region}/${content.slug}`;
    if (routes.has(route)) {
      failure(
        failed,
        "duplicate_region_slug",
        `Duplicate Region/slug: ${route}.`,
        content.legacyId,
      );
    }
    routes.add(route);
  }

  for (const region of Object.keys(EXPECTED_REGION_COUNTS) as RegionName[]) {
    if (regionCounts[region] !== EXPECTED_REGION_COUNTS[region]) {
      failure(
        failed,
        "unexpected_region_count",
        `Expected ${region} ${EXPECTED_REGION_COUNTS[region]}; found ${regionCounts[region]}.`,
      );
    }
  }

  const relationKeys = new Set<string>();
  const contentByLegacyId = new Map(
    bundle.contents.map((content) => [content.legacyId, content]),
  );
  for (const relation of bundle.relations) {
    const key = `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`;
    if (relationKeys.has(key)) {
      failure(failed, "duplicate_relation", `Duplicate relation: ${key}.`, relation.sourceLegacyId);
    }
    relationKeys.add(key);

    const source = contentByLegacyId.get(relation.sourceLegacyId);
    if (!source || source.region !== "Ruins") {
      failure(
        failed,
        "invalid_relation_source",
        `grewInto source must resolve to Ruins: ${relation.sourceLegacyId}.`,
        relation.sourceLegacyId,
      );
    }
    if (!contentByLegacyId.has(relation.targetLegacyId)) {
      failure(
        failed,
        "unresolved_relation_target",
        `Relation target does not resolve: ${relation.targetLegacyId}.`,
        relation.sourceLegacyId,
      );
    }
    if (relation.relationType !== "grewInto") {
      failure(
        failed,
        "unsupported_relation",
        "Only grewInto relations may migrate.",
        relation.sourceLegacyId,
      );
    }
  }

  const sharedValidation = validateV1MigrationBundle(bundle);
  const blocked = [...bundle.issues];
  const blockedKeys = new Set(
    blocked.map((issue) =>
      [issue.code, issue.legacyId ?? "", issue.field ?? ""].join(":"),
    ),
  );
  for (const issue of sharedValidation.issues) {
    const migrationIssue: V1MigrationIssue = {
      code: issue.code as V1MigrationIssue["code"],
      severity: "blocked",
      legacyId: issue.legacyId ?? null,
      field: issue.field ?? null,
      message: issue.message,
    };
    const key = [
      migrationIssue.code,
      migrationIssue.legacyId ?? "",
      migrationIssue.field ?? "",
    ].join(":");
    if (!blockedKeys.has(key)) {
      blocked.push(migrationIssue);
      blockedKeys.add(key);
    }
  }

  const blockedIds = new Set(
    blocked
      .filter((issue) => issue.severity === "blocked" && issue.legacyId)
      .map((issue) => issue.legacyId as string),
  );
  const importableLegacyIds = bundle.contents
    .filter(
      (content) =>
        (content.growthStage !== null ||
          !requiresGrowthStage(content.region, content.contentType)) &&
        !blockedIds.has(content.legacyId),
    )
    .map((content) => content.legacyId);
  const blockedContentExcluded = importableLegacyIds.every(
    (legacyId) => !blockedIds.has(legacyId),
  );
  if (!blockedContentExcluded) {
    failure(failed, "blocked_content_importable", "Blocked content appeared in the importable set.");
  }

  return {
    schemaVersion: 1,
    status: failed.length === 0 ? "passed" : "failed",
    migrationStatus: bundle.status,
    counts: {
      total: bundle.contents.length,
      regions: regionCounts,
      relations: bundle.relations.length,
      importable: importableLegacyIds.length,
      blocked: blockedIds.size,
    },
    blockedContentExcluded,
    importableLegacyIds,
    blocked: blocked.filter((issue) => issue.severity === "blocked"),
    failed,
    warnings: structuredClone(bundle.compatibilityWarnings),
  };
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  const report = verifyV1MigrationBundle();
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--output="))
    ?.slice("--output=".length);
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (report.status === "failed") process.exitCode = 1;
}
