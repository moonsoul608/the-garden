import type {
  ContentLanguage,
  ContentRecord,
  ContentRelation,
  ContentType,
  GrowthNote,
  GrowthStage,
  Lifecycle,
  RegionName,
  RelationType,
  V1MigrationBundle,
} from "@/types";

import type {
  ContentValidationIssue,
  ContentValidationResult,
} from "./errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const GROWTH_STAGES: ReadonlySet<GrowthStage> = new Set([
  "Seed",
  "Sprout",
  "Growing",
  "Bloom",
  "Dormant",
]);

/** Runtime counterpart to the canonical V2 GrowthStage type. */
export function isGrowthStage(value: unknown): value is GrowthStage {
  return typeof value === "string" && GROWTH_STAGES.has(value as GrowthStage);
}

const fixedTaxonomy: Record<
  RegionName,
  { contentType: ContentType; categories: ReadonlySet<string> }
> = {
  Garden: {
    contentType: "Seed",
    categories: new Set(["Psychology", "AI", "Coding", "Design & Making"]),
  },
  Forest: {
    contentType: "Question",
    categories: new Set([
      "Mind & Behavior",
      "Humans & AI",
      "Design & Experience",
      "Stories & Memory",
    ]),
  },
  Lake: {
    contentType: "Reflection",
    categories: new Set([
      "Music",
      "Games",
      "Films",
      "Books & Words",
      "Internet",
    ]),
  },
  Ruins: {
    contentType: "Trace",
    categories: new Set(["Drafts", "Attempts", "Mistakes"]),
  },
};

const allowedLifecycleTransitions: Record<Lifecycle, readonly Lifecycle[]> = {
  Draft: ["Review"],
  Review: ["Draft", "Published"],
  Published: ["Draft", "Review", "Archived"],
  Archived: [],
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
  | "region"
  | "contentType"
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

export type ReviewTaxonomyCandidate = {
  id: string;
  region: RegionName;
  contentType: ContentType;
  primaryCategories: readonly string[];
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
      `生命周期不能直接从 ${from} 变为 ${to}。`,
      { field: "lifecycle" },
    ),
  ]);
}

export function validateDraftLifecycleMutation(): ContentValidationResult {
  return finish([
    error(
      "invalid_lifecycle_transition",
      "草稿生命周期由服务器管理，不能通过草稿更新更改。",
      { field: "lifecycle" },
    ),
  ]);
}

export function validateRequiredGrowthStage(
  growthStage: GrowthStage | null | undefined,
  region: RegionName,
  contentType: ContentType,
  context: { contentId?: string; legacyId?: string } = {},
): ContentValidationResult {
  if (growthStage || !requiresGrowthStage(region, contentType)) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "missing_growth_stage",
      "必须手动指定 Growth Stage。",
      { field: "growthStage", ...context },
      "blocked",
    ),
  ]);
}

/** Central applicability rule shared by content, Admin, and migration flows. */
export function requiresGrowthStage(
  region: RegionName,
  contentType: ContentType,
): boolean {
  return !(region === "Lake" && contentType === "Reflection");
}

export function validateStableSlug(
  currentSlug: string | null,
  nextSlug: string | null,
  hasBeenPublished: boolean,
  contentId?: string,
): ContentValidationResult {
  if (!hasBeenPublished || currentSlug === nextSlug) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "immutable_slug",
      "首次发布后 Slug 不能更改。",
      { field: "slug", contentId },
    ),
  ]);
}

export function validateStableRegion(
  currentRegion: RegionName,
  nextRegion: RegionName,
  hasBeenPublished: boolean,
  contentId?: string,
): ContentValidationResult {
  if (!hasBeenPublished || currentRegion === nextRegion) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "immutable_region",
      "支持重定向前，首次发布后区域不能更改。",
      { field: "region", contentId },
    ),
  ]);
}

export function validateSlugAvailability(
  hasConflict: boolean,
  contentId?: string,
): ContentValidationResult {
  if (!hasConflict) {
    return { valid: true, issues: [] };
  }

  return finish([
    error(
      "slug_conflict",
      "拟使用的区域和 Slug 已被占用。",
      { field: "slug", contentId },
    ),
  ]);
}

export function validateReviewTaxonomy(
  content: ReviewTaxonomyCandidate,
): ContentValidationResult {
  const taxonomy = fixedTaxonomy[content.region];
  const issues: ContentValidationIssue[] = [];

  if (content.contentType !== taxonomy.contentType) {
    issues.push(
      error(
        "invalid_region_content_type",
        `${content.region} 内容必须使用 ${taxonomy.contentType} 内容类型。`,
        { field: "contentType", contentId: content.id },
      ),
    );
  }

  for (const category of content.primaryCategories) {
    if (!taxonomy.categories.has(category)) {
      issues.push(
        error(
          "invalid_primary_category",
          `${category} 不是 ${content.region} 的可用主分类。`,
          { field: "primaryCategories", contentId: content.id },
        ),
      );
    }
  }

  return finish(issues);
}

export function validateTags(
  tags: readonly string[],
  contentId?: string,
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      issues.push(
        error("invalid_tag", "标签不能为空。", {
          field: "tags",
          contentId,
        }),
      );
      continue;
    }

    const normalized = trimmed.toLocaleLowerCase();
    if (seen.has(normalized)) {
      issues.push(
        error("duplicate_tag", "不允许重复标签变体。", {
          field: "tags",
          contentId,
        }),
      );
    }
    seen.add(normalized);
  }

  return finish(issues);
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
        "没有封面路径时不能填写封面替代文本。",
        { field: "cover", ...context },
      ),
    );
  } else if (!hasPath) {
    issues.push(
      error("missing_cover_path", "封面路径不能为空。", {
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
          "提交审核或发布前，封面需要使用主要内容语言填写替代文本。",
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
      error("missing_title", "至少需要填写一个标题。", {
        field: "title",
        ...context,
      }),
    );
  }

  if (!hasText(content.summaryZh) && !hasText(content.summaryEn)) {
    issues.push(
      error("missing_summary", "至少需要填写一个摘要。", {
        field: "summary",
        ...context,
      }),
    );
  }

  if (!hasText(content.bodyZhMarkdown) && !hasText(content.bodyEnMarkdown)) {
    issues.push(
      error(
        "missing_body",
        "需要 Markdown 正文或已确认的简短详情说明。",
        { field: "bodyMarkdown", ...context },
      ),
    );
  }

  if (!hasText(content.slug)) {
    issues.push(
      error("missing_slug", "提交审核或发布前需要填写 Slug。", {
        field: "slug",
        ...context,
      }),
    );
  } else if (!SLUG_PATTERN.test(content.slug)) {
    issues.push(
      error("invalid_slug", "Slug 必须使用小写 kebab-case。", {
        field: "slug",
        ...context,
      }),
    );
  }

  if (content.primaryCategories.length === 0) {
    issues.push(
      error(
        "missing_primary_category",
        "至少需要填写一个固定主分类。",
        { field: "primaryCategories", ...context },
      ),
    );
  }

  return mergeResults(
    finish(issues),
    validateRequiredGrowthStage(
      content.growthStage,
      content.region,
      content.contentType,
      context,
    ),
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
      error("missing_title", "至少需要填写一个标题。", {
        field: "title",
        contentId: content.id,
      }),
    );
  }

  if (hasText(content.slug) && !SLUG_PATTERN.test(content.slug)) {
    issues.push(
      error("invalid_slug", "Slug 必须使用小写 kebab-case。", {
        field: "slug",
        contentId: content.id,
      }),
    );
  }

  if (lifecycle === "Archived" && !hasText(content.slug)) {
    issues.push(
      error("missing_slug", "已归档内容必须保留稳定 Slug。", {
        field: "slug",
        contentId: content.id,
      }),
    );
  }

  return mergeResults(
    finish(issues),
    validateRequiredGrowthStage(
      content.growthStage,
      content.region,
      content.contentType,
      { contentId: content.id },
    ),
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
      error("self_relation", "内容不能关联到自身。", {
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
        "已填写的关系备注不能为空。",
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
        "关系两端都必须指向现有内容。",
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
      error("duplicate_relation", "此内容关系已存在。", {
        field: "relation",
        contentId: relation.sourceContentId,
      }),
    );
  }

  return finish(issues);
}

export function validateContentRelations(
  relations: readonly RelationCandidate[],
  existingContentIds: ReadonlySet<string>,
): ContentValidationResult {
  return mergeResults(
    ...relations.map((relation, index) =>
      validateContentRelation(relation, {
        existingContentIds,
        existingRelations: relations.filter(
          (_candidate, candidateIndex) => candidateIndex !== index,
        ),
      }),
    ),
  );
}

export function validateGrowthNote(
  note: GrowthNoteCandidate,
): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];

  if (!note.toStage) {
    issues.push(
      error(
        "missing_growth_stage",
        "Growth Notes 需要填写目标 Growth Stage。",
        { field: "toStage", contentId: note.contentId },
        "blocked",
      ),
    );
  }

  if (note.fromStage && note.toStage === note.fromStage) {
    issues.push(
      error(
        "unchanged_growth_stage",
        "Growth Stage 变更必须选择不同的目标阶段。",
        { field: "toStage", contentId: note.contentId },
      ),
    );
  }

  if (!hasText(note.noteZh) && !hasText(note.noteEn)) {
    issues.push(
      error(
        "missing_growth_note",
        "Growth Stage 变更至少需要填写一个 Growth Notes 字段。",
        { field: "growthNote", contentId: note.contentId },
      ),
    );
  }

  return finish(issues);
}

export function validateGrowthStageConsistency(
  currentStage: GrowthStage | null,
  candidateStage: GrowthStage | null,
  growthNotes: readonly GrowthNoteCandidate[],
  contentId: string,
): ContentValidationResult {
  if (
    currentStage === null ||
    candidateStage === null ||
    currentStage === candidateStage
  ) {
    return { valid: true, issues: [] };
  }

  const matchingNote = growthNotes.find(
    (note) =>
      note.contentId === contentId &&
      note.fromStage === currentStage &&
      note.toStage === candidateStage,
  );

  if (matchingNote) {
    return validateGrowthNote(matchingNote);
  }

  return finish([
    error(
      "missing_growth_note",
      "提交审核前，Growth Stage 变更需要匹配的 Growth Notes。",
      { field: "growthNote", contentId },
    ),
  ]);
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
      region: content.region,
      contentType: content.contentType,
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
