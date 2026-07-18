import type {
  ContentType,
  RegionName,
  V1MigrationContentRecord,
  V1MigrationValidationPolicy,
} from "../../types/content.ts";
import { requiresGrowthStage } from "../../lib/content/validation.ts";

import { digestV1MigrationValue, stableV1MigrationJson } from "./digest.ts";

export const V1_APPROVED_SNAPSHOT_VERSION = 2 as const;

export const V1_MIGRATION_VALIDATION_POLICY = Object.freeze({
    version: "v1-migration-validation-08b1",
    growthStageApplicability: {
      policyId: "v1-growth-stage-applicability-08a2",
      required: [
        { region: "Garden", contentType: "Seed" },
        { region: "Forest", contentType: "Question" },
        { region: "Ruins", contentType: "Trace" },
      ],
      optional: [{ region: "Lake", contentType: "Reflection" }],
      nullMeaning: "not growth-tracked / not applicable",
    },
    rules: [
      "complete-source-records",
      "schema-compatibility",
      "growth-stage-applicability",
      "zero-preview-blockers",
      "preview-import-readiness",
      "matching-approval-digests",
    ],
  } satisfies V1MigrationValidationPolicy);

const CONTENT_DOMAINS: ReadonlyArray<{
  region: RegionName;
  contentType: ContentType;
}> = [
  { region: "Garden", contentType: "Seed" },
  { region: "Forest", contentType: "Question" },
  { region: "Lake", contentType: "Reflection" },
  { region: "Ruins", contentType: "Trace" },
];

function domainKey(region: RegionName, contentType: ContentType): string {
  return `${region}:${contentType}`;
}

export function calculateV1MigrationSchemaDigest(
  policy: V1MigrationValidationPolicy = V1_MIGRATION_VALIDATION_POLICY,
): string {
  return digestV1MigrationValue({
    sourceSchemaVersion: 1,
    previewSchemaVersion: 1,
    approvedSnapshotVersion: V1_APPROVED_SNAPSHOT_VERSION,
    validationPolicy: policy,
  });
}

export function isCurrentV1MigrationValidationPolicy(
  policy: V1MigrationValidationPolicy,
): boolean {
  return (
    stableV1MigrationJson(policy) ===
    stableV1MigrationJson(V1_MIGRATION_VALIDATION_POLICY)
  );
}

export function doesV1GrowthStageApplicabilityPolicyPass(
  policy: V1MigrationValidationPolicy,
  records: readonly V1MigrationContentRecord[],
): boolean {
  const required = new Set(
    policy.growthStageApplicability.required.map(({ region, contentType }) =>
      domainKey(region, contentType),
    ),
  );
  const optional = new Set(
    policy.growthStageApplicability.optional.map(({ region, contentType }) =>
      domainKey(region, contentType),
    ),
  );
  const declared = new Set([...required, ...optional]);

  if (
    policy.growthStageApplicability.nullMeaning !==
      "not growth-tracked / not applicable" ||
    declared.size !== CONTENT_DOMAINS.length ||
    CONTENT_DOMAINS.some(({ region, contentType }) => {
      const key = domainKey(region, contentType);
      return (
        !declared.has(key) ||
        required.has(key) !== requiresGrowthStage(region, contentType)
      );
    })
  ) {
    return false;
  }

  return records.every((record) => {
    const key = domainKey(record.region, record.contentType);
    return record.growthStage !== null || optional.has(key);
  });
}
