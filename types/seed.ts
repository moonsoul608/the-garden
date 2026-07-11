export const MAX_IDEA_LENGTH = 1000;

export type SeedResult = {
  seedName: string;
  coreQuestion: string;
  suggestedRegion: "Garden" | "Forest";
  growthStage: "Seed" | "Sprout";
  pathsToExplore: [string, string, string];
  firstStep: string;
};

export type SeedGardenerResponse =
  | { ok: true; seed: SeedResult }
  | { ok: false; error: string };

