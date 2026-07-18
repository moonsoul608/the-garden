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
  growthStage: GrowthStage | null;
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

export type RestoreVersionInput = {
  contentId: string;
  sourceVersionId: string;
  expectedArchivedToken: string;
  operationId: string;
};

export type PreviewDeletionImpactInput = {
  contentId: string;
};

export type DeleteArchivedContentInput = {
  contentId: string;
  expectedArchivedToken: string;
  impactDigest: string;
  operationId: string;
};

export type DeletionImpactRelation = Readonly<{
  relationId: string;
  relatedContentId: string;
  relationType: "grewFrom" | "grewInto" | "relatedTo";
}>;

export type DeletionRedirectReference = Readonly<{
  routePath: string;
  destinationPath: string | null;
  statusCode: number;
}>;

export type DeletionRevisionStatus = Readonly<{
  active: boolean;
  revisionId: string | null;
  lifecycle: "Draft" | "Review" | null;
  lockVersion: number | null;
}>;

export type DeletionImpactPreview = Readonly<{
  contentId: string;
  lifecycle: "Archived";
  expectedArchivedToken: string;
  canonicalRoute: string;
  historicalRoutes: readonly string[];
  redirectReferences: readonly DeletionRedirectReference[];
  versionCount: number;
  revisionStatus: DeletionRevisionStatus;
  inboundRelations: readonly DeletionImpactRelation[];
  outboundRelations: readonly DeletionImpactRelation[];
  storageReferenceCount: number;
  affectedInvalidationSurfaces: readonly (
    | "route"
    | "metadata"
    | "sitemap"
    | "search"
  )[];
  impactDigest: string;
}>;

export type DeletionImpactCounts = Readonly<{
  canonicalRouteCount: number;
  historicalRouteCount: number;
  redirectReferenceCount: number;
  versionCount: number;
  revisionCount: number;
  inboundRelationCount: number;
  outboundRelationCount: number;
  storageReferenceCount: number;
  invalidationSurfaceCount: number;
}>;

export type TombstoneCreationResult = Readonly<{
  requestedCount: number;
  createdCount: number;
  insertedCount: number;
  convertedCount: number;
}>;

/** Append-only operational receipt; contains no editorial or cover data. */
export type DeletionReceipt = Readonly<{
  status: "deleted" | "already_completed";
  contentId: string;
  operationId: string;
  deletedAt: string;
  deletedBy: string;
  impactCounts: DeletionImpactCounts;
  tombstoneResult: TombstoneCreationResult;
}>;

/** Durable archive receipt recovered unchanged when operationId is retried. */
export type ArchiveReceipt = Readonly<{
  contentId: string;
  operationId: string;
  versionId: string;
  archivedAt: string;
  archivedBy: string;
}>;

/** Durable restore receipt recovered unchanged when operationId is retried. */
export type RestoreReceipt = Readonly<{
  contentId: string;
  sourceVersionId: string;
  revisionId: string;
  operationId: string;
  preRestoreVersionId: string;
  lockVersion: number;
  restoredAt: string;
  restoredBy: string;
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
  candidateStage: GrowthStage | null;
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
  getReviewById(revisionId: string): Promise<DraftRevision | null>;
  listReviews(): Promise<DraftRevision[]>;
  updateDraft(input: UpdateDraftInput): Promise<DraftRevision>;
  prepareReview(input: PrepareReviewInput): Promise<ReviewReadinessReport>;
  submitForReview(input: ReviewTransitionInput): Promise<DraftRevision>;
  returnToDraft(input: ReviewTransitionInput): Promise<DraftRevision>;
  publishReview(input: PublishReviewInput): Promise<PublicationReceipt>;
  archiveContent(input: ArchiveContentInput): Promise<ArchiveReceipt>;
  restoreVersionToDraft(input: RestoreVersionInput): Promise<RestoreReceipt>;
  previewDeletionImpact(
    input: PreviewDeletionImpactInput,
  ): Promise<DeletionImpactPreview>;
  deleteArchivedContent(
    input: DeleteArchivedContentInput,
  ): Promise<DeletionReceipt>;
  startDraftRevision(
    input: StartDraftRevisionInput,
  ): Promise<DraftRevision>;
}
