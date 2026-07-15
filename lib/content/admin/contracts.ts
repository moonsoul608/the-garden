import "server-only";

import type {
  ContentLanguage,
  ContentType,
  CoverMetadata,
  DetailLevel,
  GrowthStage,
  Lifecycle,
  RegionName,
} from "@/types";
import type { ContentValidationIssue } from "@/lib/content/errors";

export type DraftContentFields = {
  slug: string | null;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  growthStage: GrowthStage;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  bodyZhMarkdown: string | null;
  bodyEnMarkdown: string | null;
  contentLanguage: ContentLanguage;
  primaryCategories: string[];
  tags: string[];
  cover: CoverMetadata | null;
  featured: boolean;
  manualOrder: number | null;
};

export type CreateDraftInput = Omit<
  DraftContentFields,
  | "slug"
  | "summaryZh"
  | "summaryEn"
  | "bodyZhMarkdown"
  | "bodyEnMarkdown"
  | "primaryCategories"
  | "tags"
  | "cover"
  | "featured"
  | "manualOrder"
> & {
  slug?: string | null;
  summaryZh?: string | null;
  summaryEn?: string | null;
  bodyZhMarkdown?: string | null;
  bodyEnMarkdown?: string | null;
  primaryCategories?: string[];
  tags?: string[];
  cover?: CoverMetadata | null;
  featured?: boolean;
  manualOrder?: number | null;
};

export type UpdateDraftInput = {
  contentId: string;
  revisionId: string;
  expectedLockVersion: number;
  changes: Partial<DraftContentFields>;
};

export type StartDraftRevisionInput = {
  contentId: string;
};

export type ReviewTransitionInput = {
  contentId: string;
  revisionId: string;
  expectedLockVersion: number;
};

export type PublishReviewInput = {
  contentId: string;
  revisionId: string;
  expectedLockVersion: number;
};

export type ArchiveContentInput = {
  contentId: string;
  expectedUpdatedAt: string;
  operationId: string;
};

/** Durable archive receipt recovered unchanged when operationId is retried. */
export type ArchiveReceipt = Readonly<{
  contentId: string;
  operationId: string;
  versionId: string;
  archivedAt: string;
  archivedBy: string;
}>;

/** Primitive-only receipt safe to cross a future Server Action boundary. */
export type PublicationReceipt = Readonly<{
  contentId: string;
  revisionId: string;
  versionId: string;
  sourceLockVersion: number;
  publishedAt: string;
  publishedBy: string;
}>;

export type PrepareReviewInput = Pick<
  ReviewTransitionInput,
  "contentId" | "revisionId"
>;

export type DraftListFilters = {
  region?: RegionName;
  contentType?: ContentType;
  growthStage?: GrowthStage;
};

/** Domain-safe revision model; database rows and actor columns stay private. */
export type DraftRevision = DraftContentFields & {
  contentId: string;
  revisionId: string;
  lifecycle: "Draft" | "Review";
  lockVersion: number;
  sourceVersionId: string | null;
  baseContentUpdatedAt: string | null;
  reviewSubmittedAt: string | null;
  returnedToDraftAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSlugConflict = {
  contentId: string;
  lifecycle: Lifecycle;
};

export type ReviewCoverStatus = {
  state: "absent" | "ready" | "missing_path" | "missing_alt";
  path: string | null;
};

export type ReviewGrowthStageConsistency = {
  publishedStage: GrowthStage | null;
  candidateStage: GrowthStage;
  changed: boolean;
  hasMatchingGrowthNote: boolean;
};

export type ReviewDifferenceSummary = {
  kind: "new" | "unchanged" | "changed";
  changedFields: (keyof DraftContentFields)[];
};

export type ReviewReadinessReport = {
  ready: boolean;
  normalizedCandidate: DraftContentFields;
  validationIssues: ContentValidationIssue[];
  missingRequirements: ContentValidationIssue[];
  slugConflicts: ReviewSlugConflict[];
  coverStatus: ReviewCoverStatus;
  growthStageConsistency: ReviewGrowthStageConsistency;
  relationIssues: ContentValidationIssue[];
  differenceFromPublished: ReviewDifferenceSummary;
};

export interface AdminContentService {
  createDraft(input: CreateDraftInput): Promise<DraftRevision>;
  getDraftById(revisionId: string): Promise<DraftRevision | null>;
  listDrafts(filters?: DraftListFilters): Promise<DraftRevision[]>;
  updateDraft(input: UpdateDraftInput): Promise<DraftRevision>;
  prepareReview(input: PrepareReviewInput): Promise<ReviewReadinessReport>;
  submitForReview(input: ReviewTransitionInput): Promise<DraftRevision>;
  returnToDraft(input: ReviewTransitionInput): Promise<DraftRevision>;
  publishReview(input: PublishReviewInput): Promise<PublicationReceipt>;
  archiveContent(input: ArchiveContentInput): Promise<ArchiveReceipt>;
  startDraftRevision(
    input: StartDraftRevisionInput,
  ): Promise<DraftRevision>;
}
