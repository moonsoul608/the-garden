import "server-only";

import type { GrowthStage, Lifecycle, RegionName, RelationType } from "@/types";

export type ContentRelationTargetOption = Readonly<{
  id: string;
  label: string;
  title: string;
  region: RegionName;
  lifecycle: Lifecycle;
  growthStage: GrowthStage | null;
  slug: string | null;
}>;

export type ContentRelationListItem = Readonly<{
  id: string;
  sourceContentId: string;
  targetContentId: string;
  relationType: RelationType;
  noteZh: string | null;
  noteEn: string | null;
  createdAt: string;
  target: ContentRelationTargetOption | null;
}>;

export type ContentRelationEditableFields = Readonly<{
  targetContentId: string;
  relationType: RelationType;
  noteZh: string | null;
  noteEn: string | null;
}>;

export type ContentRelationCreateInput = ContentRelationEditableFields &
  Readonly<{
    sourceContentId: string;
  }>;

export type ContentRelationDeleteInput = Readonly<{
  sourceContentId: string;
  relationId: string;
}>;

export interface ContentRelationsManagementService {
  listOutgoingRelations(
    sourceContentId: string,
  ): Promise<ContentRelationListItem[]>;
  listRelationTargets(
    sourceContentId: string,
  ): Promise<ContentRelationTargetOption[]>;
  createRelation(
    input: ContentRelationCreateInput,
  ): Promise<ContentRelationListItem>;
  deleteRelation(input: ContentRelationDeleteInput): Promise<void>;
}
