import type { ContentItem, PublicContentCard, RegionName } from "@/types";

type DiscoverableContent = Pick<
  ContentItem,
  "slug" | "region" | "title" | "summary"
> & {
  categories?: readonly string[];
  primaryCategories?: readonly string[];
  tags?: readonly string[];
};

export const regionOrder: RegionName[] = ["Garden", "Forest", "Lake", "Ruins"];

export const regionGroupHeadings: Record<RegionName, string> = {
  Garden: "Growing in the Garden",
  Forest: "Hidden in the Forest",
  Lake: "Reflected in the Lake",
  Ruins: "Left in the Ruins",
};

export function getContentHref(
  item: Pick<ContentItem | PublicContentCard, "region" | "slug">,
) {
  return `/${item.region.toLocaleLowerCase()}/${item.slug}`;
}

export function matchesContentSearch(item: DiscoverableContent, query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;

  return [
    item.title,
    item.summary,
    ...(item.primaryCategories ?? item.categories ?? []),
    ...(item.tags ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(term);
}
