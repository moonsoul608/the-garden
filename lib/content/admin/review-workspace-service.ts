import "server-only";

import type { ContentValidationIssueCode } from "@/lib/content/errors";

import type {
  AdminContentService,
  DraftRevision,
  ReviewReadinessReport,
} from "./contracts";
import { createAdminContentService } from "./service";
import type {
  ReviewChecklistItem,
  ReviewQueueItem,
  ReviewWorkspaceDetail,
  ReviewWorkspaceService,
} from "./review-workspace-contracts";

type ReviewWorkspaceContentService = Pick<
  AdminContentService,
  | "getDraftById"
  | "getReviewById"
  | "listReviews"
  | "prepareReview"
>;

const TAXONOMY_CODES = new Set<ContentValidationIssueCode>([
  "missing_primary_category",
  "invalid_primary_category",
  "invalid_region_content_type",
]);
const TAG_CODES = new Set<ContentValidationIssueCode>([
  "invalid_tag",
  "duplicate_tag",
]);
const SLUG_CODES = new Set<ContentValidationIssueCode>(["slug_conflict"]);
const COVER_CODES = new Set<ContentValidationIssueCode>([
  "missing_cover_path",
  "orphaned_cover_alt",
  "missing_cover_alt",
]);
const GROWTH_NOTE_CODES = new Set<ContentValidationIssueCode>([
  "missing_growth_note",
  "unchanged_growth_stage",
]);
const RELATION_CODES = new Set<ContentValidationIssueCode>([
  "self_relation",
  "duplicate_relation",
  "invalid_relation_note",
  "unresolved_relation",
  "unsupported_migration_relation",
]);
const SPECIALIZED_CODES = new Set<ContentValidationIssueCode>([
  ...TAXONOMY_CODES,
  ...TAG_CODES,
  ...SLUG_CODES,
  ...COVER_CODES,
  ...GROWTH_NOTE_CODES,
  ...RELATION_CODES,
]);

function preferredTitle(revision: DraftRevision): string {
  return revision.titleEn?.trim() || revision.titleZh?.trim() || "未命名草稿";
}

function detailsFor(
  report: ReviewReadinessReport,
  codes: ReadonlySet<ContentValidationIssueCode>,
): string[] {
  return report.validationIssues
    .filter((issue) => codes.has(issue.code))
    .map((issue) => issue.message);
}

function statusItem(
  item: Omit<ReviewChecklistItem, "state"> & { hasIssue: boolean },
): ReviewChecklistItem {
  const { hasIssue, ...rest } = item;
  return { ...rest, state: hasIssue ? "attention" : "ready" };
}

export function mapReviewChecklist(
  report: ReviewReadinessReport,
): ReviewChecklistItem[] {
  const generalIssues = report.validationIssues
    .filter((issue) => !SPECIALIZED_CODES.has(issue.code))
    .map((issue) => issue.message);
  const taxonomyIssues = detailsFor(report, TAXONOMY_CODES);
  const tagIssues = detailsFor(report, TAG_CODES);
  const slugIssues = detailsFor(report, SLUG_CODES);
  const coverIssues = detailsFor(report, COVER_CODES);
  const growthNoteIssues = detailsFor(report, GROWTH_NOTE_CODES);
  const relationIssues = report.relationIssues.map((issue) => issue.message);
  const candidate = report.normalizedCandidate;
  const difference = report.differenceFromPublished;

  return [
    statusItem({
      key: "validation",
      label: "校验",
      hasIssue: generalIssues.length > 0,
      summary:
        generalIssues.length > 0
          ? `${generalIssues.length} 个内容要求需要处理。`
          : "必填内容字段已完整。",
      details: generalIssues,
    }),
    statusItem({
      key: "taxonomy",
      label: "分类",
      hasIssue: taxonomyIssues.length > 0,
      summary:
        taxonomyIssues.length > 0
          ? "区域、内容类型或分类位置需要处理。"
          : `已检查 ${candidate.primaryCategories.length} 个主分类。`,
      details:
        taxonomyIssues.length > 0
          ? taxonomyIssues
          : candidate.primaryCategories,
    }),
    statusItem({
      key: "tags",
      label: "标签",
      hasIssue: tagIssues.length > 0,
      summary:
        tagIssues.length > 0
          ? "一个或多个标签需要处理。"
          : candidate.tags.length > 0
            ? `已检查 ${candidate.tags.length} 个标签。`
            : "未添加标签；标签为可选项。",
      details: tagIssues.length > 0 ? tagIssues : candidate.tags,
    }),
    statusItem({
      key: "slug",
      label: "Slug 冲突",
      hasIssue: slugIssues.length > 0 || report.slugConflicts.length > 0,
      summary:
        slugIssues.length > 0 || report.slugConflicts.length > 0
          ? "此区域和 Slug 已被使用。"
          : "未发现冲突的已发布路径。",
      details: slugIssues,
    }),
    statusItem({
      key: "cover",
      label: "封面元数据",
      hasIssue: coverIssues.length > 0,
      summary:
        report.coverStatus.state === "absent"
          ? "未附加封面；此审核中封面为可选项。"
          : report.coverStatus.state === "ready"
            ? "封面路径和替代文本已就绪。"
            : "封面元数据需要处理。",
      details: coverIssues,
    }),
    statusItem({
      key: "growth-notes",
      label: "Growth Notes",
      hasIssue: growthNoteIssues.length > 0,
      summary: candidate.growthStage === null
        ? "此内容不适用 Growth Stage 跟踪。"
        : report.growthStageConsistency.changed
        ? report.growthStageConsistency.hasMatchingGrowthNote
          ? "Growth Stage 变更已有对应的 Growth Notes。"
          : "Growth Stage 变更需要对应的 Growth Notes。"
        : "Growth Stage 未变化。",
      details: growthNoteIssues,
    }),
    statusItem({
      key: "relations",
      label: "Content Relations",
      hasIssue: relationIssues.length > 0,
      summary:
        relationIssues.length > 0
          ? `${relationIssues.length} 个关系问题需要处理。`
          : "Content Relations 已安全解析。",
      details: relationIssues,
    }),
    {
      key: "published-differences",
      label: "已发布差异",
      state: "information",
      summary:
        difference.kind === "new"
          ? "这将创建新的已发布路径。"
          : difference.kind === "unchanged"
            ? "没有字段与已发布版本不同。"
            : `${difference.changedFields.length} 个字段与已发布版本不同。`,
      details: difference.changedFields,
    },
  ];
}

function toQueueItem(
  revision: DraftRevision,
  report: ReviewReadinessReport,
): ReviewQueueItem {
  return {
    contentId: revision.contentId,
    revisionId: revision.revisionId,
    title: preferredTitle(revision),
    region: revision.region,
    growthStage: revision.growthStage,
    submittedAt: revision.reviewSubmittedAt ?? revision.updatedAt,
    ready: report.ready,
    attentionCount: report.validationIssues.length,
  };
}

export function createReviewWorkspaceService(
  contentService: ReviewWorkspaceContentService = createAdminContentService(),
): ReviewWorkspaceService {
  async function listReviewQueue(): Promise<ReviewQueueItem[]> {
    const reviews = await contentService.listReviews();
    const items = await Promise.all(
      reviews.map(async (revision) =>
        toQueueItem(
          revision,
          await contentService.prepareReview({
            contentId: revision.contentId,
            revisionId: revision.revisionId,
          }),
        ),
      ),
    );

    return items.sort(
      (left, right) =>
        Date.parse(right.submittedAt) - Date.parse(left.submittedAt),
    );
  }

  async function getReviewWorkspaceDetail(
    revisionId: string,
  ): Promise<ReviewWorkspaceDetail | null> {
    const revision =
      (await contentService.getReviewById(revisionId)) ??
      (await contentService.getDraftById(revisionId));
    if (!revision) return null;

    const report = await contentService.prepareReview({
      contentId: revision.contentId,
      revisionId: revision.revisionId,
    });

    return {
      revision,
      title: preferredTitle(revision),
      report,
      checklist: mapReviewChecklist(report),
    };
  }

  return { listReviewQueue, getReviewWorkspaceDetail };
}

export function listReviewQueue(): Promise<ReviewQueueItem[]> {
  return createReviewWorkspaceService().listReviewQueue();
}

export function getReviewWorkspaceDetail(
  revisionId: string,
): Promise<ReviewWorkspaceDetail | null> {
  return createReviewWorkspaceService().getReviewWorkspaceDetail(revisionId);
}
