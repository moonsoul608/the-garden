import "server-only";

import type {
  ContentLanguage,
  ContentType,
  CoverMetadata,
  DetailLevel,
  GrowthStage,
  RegionName,
} from "@/types";

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
  createdAt: string;
  updatedAt: string;
};

export interface AdminContentService {
  createDraft(input: CreateDraftInput): Promise<DraftRevision>;
  getDraftById(revisionId: string): Promise<DraftRevision | null>;
  listDrafts(filters?: DraftListFilters): Promise<DraftRevision[]>;
  updateDraft(input: UpdateDraftInput): Promise<DraftRevision>;
  startDraftRevision(
    input: StartDraftRevisionInput,
  ): Promise<DraftRevision>;
}
