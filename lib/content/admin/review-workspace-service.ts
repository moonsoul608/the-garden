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
  return revision.titleEn?.trim() || revision.titleZh?.trim() || "Untitled Draft";
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
      label: "Validation",
      hasIssue: generalIssues.length > 0,
      summary:
        generalIssues.length > 0
          ? `${generalIssues.length} content requirement${generalIssues.length === 1 ? "" : "s"} need attention.`
          : "Required content fields are complete.",
      details: generalIssues,
    }),
    statusItem({
      key: "taxonomy",
      label: "Taxonomy",
      hasIssue: taxonomyIssues.length > 0,
      summary:
        taxonomyIssues.length > 0
          ? "Region, content type, or category placement needs attention."
          : `${candidate.primaryCategories.length} primary categor${candidate.primaryCategories.length === 1 ? "y" : "ies"} checked.`,
      details:
        taxonomyIssues.length > 0
          ? taxonomyIssues
          : candidate.primaryCategories,
    }),
    statusItem({
      key: "tags",
      label: "Tags",
      hasIssue: tagIssues.length > 0,
      summary:
        tagIssues.length > 0
          ? "One or more tags need attention."
          : candidate.tags.length > 0
            ? `${candidate.tags.length} tag${candidate.tags.length === 1 ? "" : "s"} checked.`
            : "No tags added; tags are optional.",
      details: tagIssues.length > 0 ? tagIssues : candidate.tags,
    }),
    statusItem({
      key: "slug",
      label: "Slug conflict",
      hasIssue: slugIssues.length > 0 || report.slugConflicts.length > 0,
      summary:
        slugIssues.length > 0 || report.slugConflicts.length > 0
          ? "This Region and slug are already in use."
          : "No conflicting published path was found.",
      details: slugIssues,
    }),
    statusItem({
      key: "cover",
      label: "Cover metadata",
      hasIssue: coverIssues.length > 0,
      summary:
        report.coverStatus.state === "absent"
          ? "No cover is attached; a cover is optional for this review."
          : report.coverStatus.state === "ready"
            ? "Cover path and alternative text are ready."
            : "The cover metadata needs attention.",
      details: coverIssues,
    }),
    statusItem({
      key: "growth-notes",
      label: "Growth Notes",
      hasIssue: growthNoteIssues.length > 0,
      summary: candidate.growthStage === null
        ? "Growth tracking does not apply to this content."
        : report.growthStageConsistency.changed
        ? report.growthStageConsistency.hasMatchingGrowthNote
          ? "The growth-stage change has a matching Growth Note."
          : "The growth-stage change needs a matching Growth Note."
        : "The growth stage is unchanged.",
      details: growthNoteIssues,
    }),
    statusItem({
      key: "relations",
      label: "Relations",
      hasIssue: relationIssues.length > 0,
      summary:
        relationIssues.length > 0
          ? `${relationIssues.length} relation issue${relationIssues.length === 1 ? "" : "s"} need attention.`
          : "Content relations resolve safely.",
      details: relationIssues,
    }),
    {
      key: "published-differences",
      label: "Published differences",
      state: "information",
      summary:
        difference.kind === "new"
          ? "This will create a new published path."
          : difference.kind === "unchanged"
            ? "No fields differ from the published version."
            : `${difference.changedFields.length} field${difference.changedFields.length === 1 ? "" : "s"} differ from the published version.`,
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
