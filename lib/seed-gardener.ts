import { MAX_IDEA_LENGTH, type SeedResult } from "@/types/seed";

export const SEED_GARDENER_INSTRUCTION = `You are the Seed Gardener inside a personal digital garden.

Help the user turn a vague idea into a small, clear, actionable Seed.

Do not provide a long final answer.

Return exactly one json object and nothing else. Do not return Markdown, code fences, or any additional explanation.
Use the same language as the user's input for all generated text.
pathsToExplore must contain exactly 3 items.
suggestedRegion must be either Garden or Forest.
growthStage must be either Seed or Sprout.
firstStep must be a small, actionable step that can be started today.
Keep every field concise, practical, and encouraging.

Return this exact JSON shape:
{
  "seedName": "string",
  "coreQuestion": "string",
  "suggestedRegion": "Garden",
  "growthStage": "Seed",
  "pathsToExplore": [
    "string",
    "string",
    "string"
  ],
  "firstStep": "string"
}`;

export const seedResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    seedName: { type: "string", minLength: 1 },
    coreQuestion: { type: "string", minLength: 1 },
    suggestedRegion: { type: "string", enum: ["Garden", "Forest"] },
    growthStage: { type: "string", enum: ["Seed", "Sprout"] },
    pathsToExplore: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 1 },
    },
    firstStep: { type: "string", minLength: 1 },
  },
  required: [
    "seedName",
    "coreQuestion",
    "suggestedRegion",
    "growthStage",
    "pathsToExplore",
    "firstStep",
  ],
} as const;

export function validateIdea(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "Please plant an idea before continuing.";
  }
  if (value.trim().length > MAX_IDEA_LENGTH) {
    return `Please keep your idea under ${MAX_IDEA_LENGTH} characters.`;
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSeedResult(value: unknown): SeedResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result = value as Record<string, unknown>;
  const paths = result.pathsToExplore;
  if (
    !isNonEmptyString(result.seedName) ||
    !isNonEmptyString(result.coreQuestion) ||
    (result.suggestedRegion !== "Garden" && result.suggestedRegion !== "Forest") ||
    (result.growthStage !== "Seed" && result.growthStage !== "Sprout") ||
    !Array.isArray(paths) ||
    paths.length !== 3 ||
    !paths.every(isNonEmptyString) ||
    !isNonEmptyString(result.firstStep)
  ) {
    return null;
  }

  return {
    seedName: result.seedName.trim(),
    coreQuestion: result.coreQuestion.trim(),
    suggestedRegion: result.suggestedRegion,
    growthStage: result.growthStage,
    pathsToExplore: [paths[0].trim(), paths[1].trim(), paths[2].trim()],
    firstStep: result.firstStep.trim(),
  };
}
