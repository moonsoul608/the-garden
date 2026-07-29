import "server-only";

import type { GrowthStage, HomeCurationSlot, RegionName } from "@/types";

export const HOME_CURATION_SLOTS = [
  "currentlyGrowing",
  "recentlyPlanted",
] as const satisfies readonly HomeCurationSlot[];

export type HomeCurationContentOption = Readonly<{
  contentId: string;
  title: string;
  region: RegionName;
  growthStage: GrowthStage | null;
  updatedAt: string;
}>;

export type HomeCurationSlotItem = HomeCurationContentOption &
  Readonly<{
    slot: HomeCurationSlot;
    order: number;
  }>;

export type HomeCurationWorkspace = Readonly<{
  slots: Readonly<Record<HomeCurationSlot, readonly HomeCurationSlotItem[]>>;
  options: readonly HomeCurationContentOption[];
}>;

export type HomeCurationSelection = Readonly<{
  slot: HomeCurationSlot;
  contentId: string;
  order: number;
}>;

export type SaveHomeCurationInput = Readonly<{
  selections: readonly HomeCurationSelection[];
}>;

export interface HomeCurationManagementService {
  getWorkspace(): Promise<HomeCurationWorkspace>;
  saveHomeCuration(input: SaveHomeCurationInput): Promise<HomeCurationWorkspace>;
}
