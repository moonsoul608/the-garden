import type {
  ContentLanguage,
  ContentRecord,
  ContentRelation,
  GrowthNote,
  GrowthStage,
  Lifecycle,
  RelationType,
  V1MigrationBundle,
} from "@/types";

import type {
  ContentValidationIssue,
  ContentValidationResult,
} from "./errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const allowedLifecycleTransitions: Record<Lifecycle, readonly Lifecycle[]> = {
  Draft: ["Review"],
  Review: ["Draft", "Published"],
  Published: ["Draft", "Review", "Archived"],
  Archived: ["Published"],
};

type CoverCandidate = {
  path?: string | null;
  altZh?: string | null;
  altEn?: string | null;
} | null;

export type PublicationCandidate = Pick<
  ContentRecord,
  | "id"
  | "slug"
  | "titleZh"
  | "titleEn"
  | "summaryZh"
  | "summaryEn"
  | "bodyZhMarkdown"
  | "bodyEnMarkdown"
  | "contentLanguage"
  | "primaryCategories"
> & {
  growthStage: GrowthStage | null | undefined;
  cover: CoverCandidate;
};

export type GrowthNoteCandidate = Pick<
  GrowthNote,
  "contentId" | "noteZh" | "noteEn" | "isPublic"
> & {
  fromStage?: GrowthStage | null;
  toStage?: GrowthStage | null;
};

export type RelationCandidate = Pick<
  ContentRelation,
  | "sourceContentId"
  | "targetContentId"
  | "relationType"
  | "noteZh"
  | "noteEn"
>;

export type RelationValidationContext = {
  existingRelations?: readonly RelationCandidate[];
  existingContentIds?: ReadonlySet<string>;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finish(
  issues: ContentValidationIssue[],
): ContentValidationResult {
  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}

function mergeResults(
  ...results: ContentValidationResult[]
): ContentValidationResult {
  return finish(results.flatMap((result) => result.issues));
}

function error(
  code: ContentValidationIssue["code"],
  message: string,
  details: Omit<ContentValidationIssue, "code" | "message" | "severity"> = {},
  severity: ContentValidationIssue["severity"] = "error",
): ContentValidationIssue {
  return { code, message, severity, ...details };
}

export function validateLifecycleTransition(
  from: Lifecycle,
  to: Lifecycle,
): ContentValidationResult {
  if (from !== to && allowedLifecycleTransitions[from].includes(to)) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "invalid_lifecycle_transition",
      `Lifecycle cannot move directly from ${from} to ${to}.`,
      { field: "lifecycle" },
    ),
  ]);
}

export function validateRequiredGrowthStage(
  growthStage: GrowthStage | null | undefined,
  context: { contentId?: string; legacyId?: string } = {},
): ContentValidationResult {
  if (growthStage) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "missing_growth_stage",
      "Growth Stage is required and must be assigned manually.",
      { field: "growthStage", ...context },
      "blocked",
    ),
  ]);
}

export function validateCoverRequirements(
  cover: CoverCandidate,
  lifecycle: Lifecycle,
  contentLanguage: ContentLanguage,
  context: { contentId?: string; legacyId?: string } = {},
): ContentValidationResult {
  if (!cover) {
    return { valid: true, issues: [] };
  }

  const issues: ContentValidationIssue[] = [];
  const hasPath = hasText(cover.path);
  const hasAltZh = hasText(cover.altZh);
  const hasAltEn = hasText(cover.altEn);

  if (!hasPath && (hasAltZh || hasAltEn)) {
    issues.push(
      error(
        "orphaned_cover_alt",
        "Cover alt text cannot exist without a cover path.",
        { field: "cover", ...context },
      ),
    );
  } else if (!hasPath) {
    issues.push(
      error("missing_cover_path", "Cover path cannot be blank.", {
        field: "cover.path",
        ...context,
      }),
    );
  }

  if (lifecycle !== "Draft" && hasPath) {
    const hasRequiredAlt =
      contentLanguage === "zh"
        ? hasAltZh
        : contentLanguage === "en"
          ? hasAltEn
          : hasAltZh || hasAltEn;

    if (!hasRequiredAlt) {
      issues.push(
        error(
          "missing_cover_alt",
          "A cover requires alt text in the primary content language before Review or publication.",
          { field: "cover", ...context },
        ),
      );
    }
  }

  return finish(issues);
}

export function validatePublicationRequirements(
  content: PublicationCandidate,
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];
  const context = { contentId: content.id };

  if (!hasText(content.titleZh) && !hasText(content.titleEn)) {
    issues.push(
      error("missing_title", "At least one title is required.", {
        field: "title",
        ...context,
      }),
    );
  }

  if (!hasText(content.summaryZh) && !hasText(content.summaryEn)) {
    issues.push(
      error("missing_summary", "At least one summary is required.", {
        field: "summary",
        ...context,
      }),
    );
  }

  if (!hasText(content.bodyZhMarkdown) && !hasText(content.bodyEnMarkdown)) {
    issues.push(
      error(
        "missing_body",
        "A Markdown body or confirmed short-detail explanation is required.",
        { field: "bodyMarkdown", ...context },
      ),
    );
  }

  if (!hasText(content.slug)) {
    issues.push(
      error("missing_slug", "A slug is required before Review or publication.", {
        field: "slug",
        ...context,
      }),
    );
  } else if (!SLUG_PATTERN.test(content.slug)) {
    issues.push(
      error("invalid_slug", "Slug must use lowercase kebab-case.", {
        field: "slug",
        ...context,
      }),
    );
  }

  if (content.primaryCategories.length === 0) {
    issues.push(
      error(
        "missing_primary_category",
        "At least one fixed primary category is required.",
        { field: "primaryCategories", ...context },
      ),
    );
  }

  return mergeResults(
    finish(issues),
    validateRequiredGrowthStage(content.growthStage, context),
    validateCoverRequirements(
      content.cover,
      "Published",
      content.contentLanguage,
      context,
    ),
  );
}

export function validateLifecycleRequirements(
  content: PublicationCandidate,
  lifecycle: Lifecycle,
): ContentValidationResult {
  if (lifecycle === "Review" || lifecycle === "Published") {
    return validatePublicationRequirements(content);
  }

  const issues: ContentValidationIssue[] = [];

  if (!hasText(content.titleZh) && !hasText(content.titleEn)) {
    issues.push(
      error("missing_title", "At least one title is required.", {
        field: "title",
        contentId: content.id,
      }),
    );
  }

  if (lifecycle === "Archived" && !hasText(content.slug)) {
    issues.push(
      error("missing_slug", "Archived content must retain its stable slug.", {
        field: "slug",
        contentId: content.id,
      }),
    );
  }

  return mergeResults(
    finish(issues),
    validateRequiredGrowthStage(content.growthStage, {
      contentId: content.id,
    }),
    validateCoverRequirements(
      content.cover,
      lifecycle,
      content.contentLanguage,
      { contentId: content.id },
    ),
  );
}

export function validateContentRelation(
  relation: RelationCandidate,
  context: RelationValidationContext = {},
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];

  if (relation.sourceContentId === relation.targetContentId) {
    issues.push(
      error("self_relation", "Content cannot relate to itself.", {
        field: "targetContentId",
        contentId: relation.sourceContentId,
      }),
    );
  }

  if (
    (relation.noteZh !== null && !hasText(relation.noteZh)) ||
    (relation.noteEn !== null && !hasText(relation.noteEn))
  ) {
    issues.push(
      error(
        "invalid_relation_note",
        "A provided relation note cannot be blank.",
        { field: "relationNote", contentId: relation.sourceContentId },
      ),
    );
  }

  if (
    context.existingContentIds &&
    (!context.existingContentIds.has(relation.sourceContentId) ||
      !context.existingContentIds.has(relation.targetContentId))
  ) {
    issues.push(
      error(
        "unresolved_relation",
        "Both relation endpoints must resolve to existing content.",
        { field: "relation", contentId: relation.sourceContentId },
      ),
    );
  }

  const duplicate = context.existingRelations?.some(
    (existing) =>
      existing.sourceContentId === relation.sourceContentId &&
      existing.targetContentId === relation.targetContentId &&
      existing.relationType === relation.relationType,
  );

  if (duplicate) {
    issues.push(
      error("duplicate_relation", "This content relation already exists.", {
        field: "relation",
        contentId: relation.sourceContentId,
      }),
    );
  }

  return finish(issues);
}

export function validateGrowthNote(
  note: GrowthNoteCandidate,
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];

  if (!note.toStage) {
    issues.push(
      error(
        "missing_growth_stage",
        "A Growth Note requires its destination Growth Stage.",
        { field: "toStage", contentId: note.contentId },
        "blocked",
      ),
    );
  }

  if (note.fromStage && note.toStage === note.fromStage) {
    issues.push(
      error(
        "unchanged_growth_stage",
        "A Growth Stage change must choose a different destination stage.",
        { field: "toStage", contentId: note.contentId },
      ),
    );
  }

  if (!hasText(note.noteZh) && !hasText(note.noteEn)) {
    issues.push(
      error(
        "missing_growth_note",
        "A Growth Stage change requires at least one Growth Note field.",
        { field: "growthNote", contentId: note.contentId },
      ),
    );
  }

  return finish(issues);
}

export function validateV1MigrationBundle(
  bundle: V1MigrationBundle,
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];
  const legacyIds = new Set<string>();
  const routes = new Set<string>();
  const relationKeys = new Set<string>();

  for (const content of bundle.contents) {
    if (legacyIds.has(content.legacyId)) {
      issues.push(
        error(
          "duplicate_legacy_id",
          `Duplicate V1 legacy ID: ${content.legacyId}.`,
          { field: "legacyId", legacyId: content.legacyId },
          "blocked",
        ),
      );
    }
    legacyIds.add(content.legacyId);

    const routeKey = `${content.region}/${content.slug}`;
    if (routes.has(routeKey)) {
      issues.push(
        error(
          "duplicate_route",
          `Duplicate V1 Region and slug: ${routeKey}.`,
          { field: "slug", legacyId: content.legacyId },
          "blocked",
        ),
      );
    }
    routes.add(routeKey);

    const candidate: PublicationCandidate = {
      id: content.legacyId,
      slug: content.slug,
      titleZh: content.titleZh,
      titleEn: content.titleEn,
      summaryZh: content.summaryZh,
      summaryEn: content.summaryEn,
      bodyZhMarkdown: content.bodyZhMarkdown,
      bodyEnMarkdown: content.bodyEnMarkdown,
      contentLanguage: content.contentLanguage,
      primaryCategories: content.primaryCategories,
      growthStage: content.growthStage,
      cover: content.cover,
    };

    const validation = validatePublicationRequirements(candidate);
    issues.push(
      ...validation.issues.map((issue) => ({
        ...issue,
        contentId: undefined,
        legacyId: content.legacyId,
      })),
    );
  }

  for (const relation of bundle.relations) {
    const relationKey = `${relation.sourceLegacyId}:${relation.targetLegacyId}:${relation.relationType}`;
    if (relationKeys.has(relationKey)) {
      issues.push(
        error(
          "duplicate_relation",
          `Duplicate V1 grewInto relationship: ${relationKey}.`,
          { field: "relation", legacyId: relation.sourceLegacyId },
          "blocked",
        ),
      );
    }
    relationKeys.add(relationKey);

    if ((relation.relationType as RelationType) !== "grewInto") {
      issues.push(
        error(
          "unsupported_migration_relation",
          "Only explicit V1 Ruins grewInto relationships may be migrated.",
          { field: "relationType", legacyId: relation.sourceLegacyId },
          "blocked",
        ),
      );
    }

    if (!legacyIds.has(relation.sourceLegacyId)) {
      issues.push(
        error(
          "unresolved_relation",
          `Relation source does not resolve: ${relation.sourceLegacyId}.`,
          { field: "sourceLegacyId", legacyId: relation.sourceLegacyId },
          "blocked",
        ),
      );
    }

    if (!legacyIds.has(relation.targetLegacyId)) {
      issues.push(
        error(
          "unresolved_relation",
          `Relation target does not resolve: ${relation.targetLegacyId}.`,
          { field: "targetLegacyId", legacyId: relation.sourceLegacyId },
          "blocked",
        ),
      );
    }

    if (relation.sourceLegacyId === relation.targetLegacyId) {
      issues.push(
        error(
          "self_relation",
          "A migrated grewInto relationship cannot target itself.",
          { field: "targetLegacyId", legacyId: relation.sourceLegacyId },
          "blocked",
        ),
      );
    }
  }

  return finish(issues);
}

export function deriveV1MigrationStatus(
  result: ContentValidationResult,
): V1MigrationBundle["status"] {
  return result.valid ? "ready" : "blocked";
}

export type { ContentValidationResult } from "./errors";
