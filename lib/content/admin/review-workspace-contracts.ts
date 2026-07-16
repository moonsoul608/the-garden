import type { DraftRevision, ReviewReadinessReport } from "./contracts";

export type ReviewChecklistKey =
  | "validation"
  | "taxonomy"
  | "tags"
  | "slug"
  | "cover"
  | "growth-notes"
  | "relations"
  | "published-differences";

export type ReviewChecklistState = "ready" | "attention" | "information";

export type ReviewChecklistItem = Readonly<{
  key: ReviewChecklistKey;
  label: string;
  state: ReviewChecklistState;
  summary: string;
  details: readonly string[];
}>;

export type ReviewQueueItem = Readonly<{
  contentId: string;
  revisionId: string;
  title: string;
  region: DraftRevision["region"];
  growthStage: DraftRevision["growthStage"];
  submittedAt: string;
  ready: boolean;
  attentionCount: number;
}>;

export type ReviewWorkspaceDetail = Readonly<{
  revision: DraftRevision;
  title: string;
  report: ReviewReadinessReport;
  checklist: readonly ReviewChecklistItem[];
}>;

export interface ReviewWorkspaceService {
  listReviewQueue(): Promise<ReviewQueueItem[]>;
  getReviewWorkspaceDetail(
    revisionId: string,
  ): Promise<ReviewWorkspaceDetail | null>;
}
