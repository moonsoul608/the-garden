import { allContent } from "@/content";
import type {
  ContentItem,
  PublicContentCard,
  RuinsItem,
} from "@/types";

export type PublicContentPresentation = PublicContentCard & {
  id: string;
  categories: string[];
  status?: NonNullable<PublicContentCard["growthStage"]>;
  cta: string;
  grewInto?: string;
};

const legacyPresentationByRoute = new Map(
  allContent.map((item) => [`${item.region}/${item.slug}`, item] as const),
);

const fallbackCtaByType: Record<PublicContentCard["contentType"], string> = {
  Seed: "Open this seed →",
  Question: "Follow this question →",
  Reflection: "Look closer →",
  Trace: "Read this trace →",
};

function legacyPresentationFor(
  item: PublicContentCard,
): ContentItem | undefined {
  return legacyPresentationByRoute.get(`${item.region}/${item.slug}`);
}

/**
 * Keeps the V1 card-language layer stable while every content-bearing value
 * comes from the active public content service.
 */
export function presentPublicContentCard(
  item: PublicContentCard,
): PublicContentPresentation {
  const legacy = legacyPresentationFor(item);
  const legacyTrace =
    legacy?.region === "Ruins" ? (legacy as RuinsItem) : undefined;

  return {
    ...item,
    id: item.slug,
    categories: [...item.primaryCategories],
    ...(item.growthStage ? { status: item.growthStage } : {}),
    cta: legacy?.cta ?? fallbackCtaByType[item.contentType],
    ...(legacyTrace?.grewInto ? { grewInto: legacyTrace.grewInto } : {}),
  };
}

export function presentPublicContentCards(
  items: readonly PublicContentCard[],
): PublicContentPresentation[] {
  return items.map(presentPublicContentCard);
}
