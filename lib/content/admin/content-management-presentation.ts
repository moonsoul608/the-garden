import type { GrowthStage } from "@/types";

const growthMarkers: Record<GrowthStage, string> = {
  Seed: "🌰",
  Sprout: "🌱",
  Growing: "🌿",
  Bloom: "🌸",
  Dormant: "🍂",
};

export type AdminGrowthPresentation = Readonly<{
  label: GrowthStage | "不跟踪 Growth Stage";
  marker: string | null;
}>;

export function getAdminGrowthPresentation(
  growthStage: GrowthStage | null,
): AdminGrowthPresentation {
  return growthStage
    ? { label: growthStage, marker: growthMarkers[growthStage] }
    : { label: "不跟踪 Growth Stage", marker: null };
}
