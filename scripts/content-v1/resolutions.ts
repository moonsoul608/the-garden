import type {
  V1GrowthStageApproval,
  V1GrowthStageResolutionAudit,
  V1MigrationBundle,
  V1MigrationIssue,
  V1MigrationResolutionInput,
  V1PublishedAtMigrationPolicy,
} from "../../types/content.ts";
import { isGrowthStage } from "../../lib/content/validation.ts";

export const V1_GROWTH_STAGE_BLOCKER_IDS = [
  "reverse-1999",
  "jung-and-mandala",
  "the-garden",
  "love-love-love",
  "summer-ghost",
] as const;

const GROWTH_STAGE_BLOCKER_REASON =
  "V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage.";

export const V1_PUBLISHED_AT_POLICY: V1PublishedAtMigrationPolicy = Object.freeze({
  policyId: "v1-published-at-preserve-null",
  outcome: "preserve-null",
  approvalStatus: "Approved",
  resolutionSource: "docs/V2_PHASE_06B1_MIGRATION_BLOCKER_RESOLUTION.md",
  rationale:
    "No V1 record contains confirmed plantedOn metadata. Preserve null for the legacy Published migration candidates instead of inventing editorial history; normal V2 publication continues to create a timestamp.",
  prohibitsDerivedDates: true,
});

export type V1ResolutionResult = {
  bundle: V1MigrationBundle;
  growthStages: V1GrowthStageResolutionAudit[];
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return hasText(value) && !Number.isNaN(Date.parse(value));
}

function validateApproval(value: unknown): value is V1GrowthStageApproval {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const approval = value as Record<string, unknown>;
  const legacyId = hasText(approval.legacyId) ? approval.legacyId : null;
  return (
    approval.source === "v1-static-typescript" &&
    legacyId !== null &&
    approval.route === `/lake/${legacyId}` &&
    isGrowthStage(approval.growthStage) &&
    approval.decisionMethod === "manual" &&
    hasText(approval.resolutionSource) &&
    hasText(approval.approvedBy) &&
    isIsoDate(approval.approvedAt) &&
    approval.approvalStatus === "Approved" &&
    hasText(approval.notes)
  );
}

export function parseV1MigrationResolutionInput(
  value: unknown,
): V1MigrationResolutionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resolution input must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  if (
    input.schemaVersion !== 1 ||
    input.kind !== "v1-migration-resolution-input" ||
    !Array.isArray(input.growthStages)
  ) {
    throw new Error(
      "Resolution input must use schemaVersion 1, kind v1-migration-resolution-input, and a growthStages array.",
    );
  }
  return input as V1MigrationResolutionInput;
}

function invalidResolutionIssue(
  legacyId: string | null,
  message: string,
): V1MigrationIssue {
  return {
    code: "invalid_value",
    severity: "blocked",
    legacyId,
    field: "growthStage",
    message,
  };
}

export function applyV1MigrationResolutions(
  sourceBundle: V1MigrationBundle,
  input: V1MigrationResolutionInput | null = null,
): V1ResolutionResult {
  const contents = structuredClone(sourceBundle.contents);
  let issues = structuredClone(sourceBundle.issues);
  const decisions = input?.growthStages ?? [];
  const knownIds = new Set<string>(V1_GROWTH_STAGE_BLOCKER_IDS);

  for (const decision of decisions) {
    if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
      issues.push(
        invalidResolutionIssue(
          null,
          "A Growth Stage resolution record is malformed and has no valid source identity.",
        ),
      );
      continue;
    }
    const legacyId =
      hasText(decision.legacyId)
        ? decision.legacyId
        : null;
    if (!legacyId) {
      issues.push(
        invalidResolutionIssue(
          null,
          "A Growth Stage resolution record is missing its legacy source identity.",
        ),
      );
    } else if (!knownIds.has(legacyId)) {
      issues.push(
        invalidResolutionIssue(
          null,
          `Growth Stage approval targets non-blocked or unknown legacy ID ${legacyId}.`,
        ),
      );
    }
  }

  const growthStages = V1_GROWTH_STAGE_BLOCKER_IDS.map((legacyId) => {
    const matches = decisions.filter(
      (decision) =>
        decision &&
        typeof decision === "object" &&
        decision.legacyId === legacyId,
    );
    const decision = matches[0];
    const base = {
      sourceIdentity: {
        source: "v1-static-typescript" as const,
        legacyId,
        route: `/lake/${legacyId}`,
      },
      legacyId,
      blockerReason: GROWTH_STAGE_BLOCKER_REASON,
    };

    if (matches.length === 0) {
      return {
        ...base,
        growthStage: null,
        decisionMethod: null,
        resolutionSource: null,
        approvedBy: null,
        approvedAt: null,
        approvalStatus: "Pending" as const,
        notes: null,
      };
    }

    if (matches.length > 1 || !validateApproval(decision)) {
      issues.push(
        invalidResolutionIssue(
          legacyId,
          matches.length > 1
            ? `Multiple Growth Stage approvals were provided for ${legacyId}.`
            : `Growth Stage approval for ${legacyId} is incomplete or invalid; the exact source identity, a manual method, allowed value, review source, approver, approval time, Approved status, and notes are required.`,
        ),
      );
      return {
        ...base,
        growthStage: null,
        decisionMethod:
          decision && decision.decisionMethod === "manual"
            ? ("manual" as const)
            : null,
        resolutionSource:
          decision && hasText(decision.resolutionSource)
            ? decision.resolutionSource
            : null,
        approvedBy:
          decision && hasText(decision.approvedBy) ? decision.approvedBy : null,
        approvedAt:
          decision && isIsoDate(decision.approvedAt) ? decision.approvedAt : null,
        approvalStatus: "Invalid" as const,
        notes: decision && hasText(decision.notes) ? decision.notes : null,
      };
    }

    const content = contents.find((candidate) => candidate.legacyId === legacyId);
    if (!content) {
      issues.push(
        invalidResolutionIssue(
          null,
          `Approved Growth Stage target ${legacyId} is absent from the V1 bundle.`,
        ),
      );
      return {
        ...base,
        growthStage: null,
        decisionMethod: decision.decisionMethod,
        resolutionSource: decision.resolutionSource,
        approvedBy: decision.approvedBy,
        approvedAt: decision.approvedAt,
        approvalStatus: "Invalid" as const,
        notes: decision.notes,
      };
    }

    content.growthStage = decision.growthStage;
    issues = issues.filter(
      (issue) =>
        !(
          issue.code === "missing_growth_stage" &&
          issue.legacyId === legacyId
        ),
    );
    return {
      ...base,
      growthStage: decision.growthStage,
      decisionMethod: decision.decisionMethod,
      resolutionSource: decision.resolutionSource,
      approvedBy: decision.approvedBy,
      approvedAt: decision.approvedAt,
      approvalStatus: "Approved" as const,
      notes: decision.notes,
    };
  });

  return {
    bundle: {
      ...sourceBundle,
      contents,
      issues,
      status: issues.some((issue) => issue.severity === "blocked")
        ? "blocked"
        : "ready",
    },
    growthStages,
  };
}

export function validateV1PublishedAtPolicy(
  bundle: V1MigrationBundle,
  policy: V1PublishedAtMigrationPolicy = V1_PUBLISHED_AT_POLICY,
): V1MigrationIssue[] {
  const issues: V1MigrationIssue[] = [];
  if (
    policy.policyId !== "v1-published-at-preserve-null" ||
    policy.outcome !== "preserve-null" ||
    policy.approvalStatus !== "Approved" ||
    !hasText(policy.resolutionSource) ||
    policy.prohibitsDerivedDates !== true
  ) {
    issues.push({
      code: "invalid_value",
      severity: "blocked",
      legacyId: null,
      field: "publishedAt",
      message: "The legacy publishedAt policy is missing or not explicitly approved.",
    });
    return issues;
  }

  for (const content of bundle.contents) {
    if (content.lifecycle === "Published" && content.publishedAt !== null) {
      issues.push({
        code: "invalid_value",
        severity: "blocked",
        legacyId: content.legacyId,
        field: "publishedAt",
        message: `Legacy publishedAt policy requires null for ${content.legacyId}; derived or unconfirmed dates are forbidden.`,
      });
    }
  }
  return issues;
}
