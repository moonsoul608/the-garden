import type { GrowthStage } from "@/types";

const growthMarkers: Record<GrowthStage, string> = {
  Seed: "🌰",
  Sprout: "🌱",
  Growing: "🌿",
  Bloom: "🌸",
  Dormant: "🍂",
};

export type AdminGrowthPresentation = Readonly<{
  label: GrowthStage | "Not growth-tracked";
  marker: string | null;
}>;

export function getAdminGrowthPresentation(
  growthStage: GrowthStage | null,
): AdminGrowthPresentation {
  return growthStage
    ? { label: growthStage, marker: growthMarkers[growthStage] }
    : { label: "Not growth-tracked", marker: null };
}
