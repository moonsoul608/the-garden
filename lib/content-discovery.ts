import type { ContentItem, RegionName } from "@/types";

export const regionOrder: RegionName[] = ["Garden", "Forest", "Lake", "Ruins"];

export const regionGroupHeadings: Record<RegionName, string> = {
  Garden: "Growing in the Garden",
  Forest: "Hidden in the Forest",
  Lake: "Reflected in the Lake",
  Ruins: "Left in the Ruins",
};

export function getContentHref(item: ContentItem) {
  return `/${item.region.toLocaleLowerCase()}/${item.slug}`;
}

export function matchesContentSearch(item: ContentItem, query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;

  return [item.title, item.summary, ...item.categories, ...(item.tags ?? [])]
    .join(" ")
    .toLocaleLowerCase()
    .includes(term);
}
