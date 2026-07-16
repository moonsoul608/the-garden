import "server-only";

import type { GrowthStage, Lifecycle, RegionName } from "@/types";

export type AdminContentRevisionSummary = Readonly<{
  revisionId: string;
  lifecycle: "Draft" | "Review";
  lockVersion: number;
  titleZh: string | null;
  titleEn: string | null;
  region: RegionName;
  growthStage: GrowthStage;
  updatedAt: string;
}>;

export type AdminContentListRecord = Readonly<{
  contentId: string;
  lifecycle: Lifecycle;
  titleZh: string | null;
  titleEn: string | null;
  region: RegionName;
  growthStage: GrowthStage;
  updatedAt: string;
  activeRevision: AdminContentRevisionSummary | null;
}>;

export type AdminContentListItem = Readonly<{
  contentId: string;
  title: string;
  region: RegionName;
  lifecycle: Lifecycle;
  growthStage: GrowthStage;
  updatedAt: string;
  revisionId: string | null;
  revisionLifecycle: "Draft" | "Review" | null;
  lockVersion: number | null;
}>;

export interface AdminContentManagementService {
  listContent(): Promise<AdminContentListItem[]>;
}
