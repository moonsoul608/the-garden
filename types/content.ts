export type RegionName = "Garden" | "Forest" | "Lake" | "Ruins";
export type SiteRegionName = "Home" | RegionName | "Greenhouse";
export type ContentType = "Seed" | "Question" | "Reflection" | "Trace";
export type GrowthStatus = "Seed" | "Sprout" | "Growing" | "Bloom" | "Dormant";
export type DetailLevel = "full" | "short";

export type ContentItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  status?: GrowthStatus;
  categories: string[];
  tags?: string[];
  plantedOn?: string;
  lastTended?: string;
  cta: string;
  image?: string;
};

export type GardenItem = ContentItem & { region: "Garden"; contentType: "Seed"; beds: string[] };
export type ForestItem = ContentItem & { region: "Forest"; contentType: "Question"; trails: string[] };
export type LakeItem = ContentItem & {
  region: "Lake";
  contentType: "Reflection";
  reflectionType: string;
  reason: string;
};
export type RuinsItem = ContentItem & {
  region: "Ruins";
  contentType: "Trace";
  traceType: string;
  grewInto?: string;
};

export type SeedResult = {
  seedName: string;
  coreQuestion: string;
  suggestedRegion: "Garden" | "Forest";
  growthStage: "Seed" | "Sprout";
  pathsToExplore: [string, string, string];
  firstStep: string;
};
