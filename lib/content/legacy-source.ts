import "server-only";

import { detailContent, type DetailBlock } from "@/content/details";
import { forestItems } from "@/content/forest";
import { gardenItems } from "@/content/garden";
import { lakeItems } from "@/content/lake";
import { ruinsItems } from "@/content/ruins";
import type {
  ContentItem,
  ContentQuery,
  PublicContentCard,
  PublicContentDetail,
  PublicHomeCurationItem,
  RegionName,
} from "@/types";

import { ContentMappingError } from "./errors";

const legacyItems: ContentItem[] = [
  ...gardenItems,
  ...forestItems,
  ...lakeItems,
  ...ruinsItems,
];

export interface LegacyContentSource {
  getPublishedContent(query?: ContentQuery): Promise<PublicContentCard[]>;
  getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null>;
  getPublishedHomeCuration(): Promise<PublicHomeCurationItem[]>;
}

function mapLegacyItemToPublicCard(item: ContentItem): PublicContentCard {
  return {
    id: item.id,
    slug: item.slug,
    region: item.region,
    contentType: item.contentType,
    detailLevel: item.detailLevel,
    growthStage: item.status ?? null,
    contentLanguage: null,
    title: item.title,
    summary: item.summary,
    titleZh: null,
    titleEn: null,
    summaryZh: null,
    summaryEn: null,
    primaryCategories: [...item.categories],
    tags: [...(item.tags ?? [])],
    cover: null,
    featured: false,
    manualOrder: null,
    publishedAt: null,
    lastTendedAt: null,
  };
}

function mapDetailBlockToMarkdown(block: DetailBlock): string {
  if (block.type === "paragraph") return block.text.trim();
  if (block.type === "list") {
    return block.items.map((item) => `- ${item.trim()}`).join("\n");
  }

  return block.items
    .map((note) => `### ${note.title.trim()}\n\n${note.text.trim()}`)
    .join("\n\n");
}

function getLegacyBodyMarkdown(item: ContentItem): string {
  const detail = detailContent[item.region][item.slug];
  if (!detail) throw new ContentMappingError("legacy detail body");

  if (item.detailLevel === "short") {
    if (!detail.explanation?.trim()) {
      throw new ContentMappingError("legacy short-detail explanation");
    }
    return detail.explanation.trim();
  }

  const body = detail.sections
    ?.map((section) => {
      const blocks = section.blocks.map(mapDetailBlockToMarkdown).join("\n\n");
      return `## ${section.title.trim()}\n\n${blocks}`;
    })
    .join("\n\n");

  if (!body?.trim()) throw new ContentMappingError("legacy full-detail body");
  return body;
}

function matchesQuery(item: PublicContentCard, query: ContentQuery): boolean {
  if (query.lifecycles && !query.lifecycles.includes("Published")) return false;
  if (query.regions?.length && !query.regions.includes(item.region)) return false;
  if (
    query.contentTypes?.length &&
    !query.contentTypes.includes(item.contentType)
  ) {
    return false;
  }
  if (
    query.growthStages?.length &&
    (!item.growthStage || !query.growthStages.includes(item.growthStage))
  ) {
    return false;
  }
  if (query.featured !== undefined && query.featured !== item.featured) {
    return false;
  }
  if (
    query.primaryCategories?.length &&
    !query.primaryCategories.some((category) =>
      item.primaryCategories.includes(category),
    )
  ) {
    return false;
  }
  if (
    query.tags?.length &&
    !query.tags.some((tag) =>
      item.tags.some(
        (itemTag) =>
          itemTag.toLocaleLowerCase() === tag.trim().toLocaleLowerCase(),
      ),
    )
  ) {
    return false;
  }

  const search = query.search?.trim().toLocaleLowerCase();
  if (search) {
    const searchable = [
      item.title,
      item.summary,
      ...item.primaryCategories,
      ...item.tags,
    ]
      .join(" ")
      .toLocaleLowerCase();
    if (!searchable.includes(search)) return false;
  }

  return true;
}

export function createLegacyContentSource(): LegacyContentSource {
  async function getPublishedContent(
    query: ContentQuery = {},
  ): Promise<PublicContentCard[]> {
    const items = legacyItems
      .map(mapLegacyItemToPublicCard)
      .filter((item) => matchesQuery(item, query));
    const offset = Math.max(0, query.offset ?? 0);

    return query.limit === undefined
      ? items.slice(offset)
      : items.slice(offset, offset + Math.max(0, query.limit));
  }

  async function getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null> {
    const item = legacyItems.find(
      (candidate) => candidate.region === region && candidate.slug === slug,
    );
    if (!item) return null;

    return {
      ...mapLegacyItemToPublicCard(item),
      bodyMarkdown: getLegacyBodyMarkdown(item),
      bodyZhMarkdown: null,
      bodyEnMarkdown: null,
      growthTimeline: [],
      relations: [],
    };
  }

  async function getPublishedHomeCuration(): Promise<
    PublicHomeCurationItem[]
  > {
    // V1 duplicates and display overrides are intentionally deferred.
    return [];
  }

  return {
    getPublishedContent,
    getPublishedContentByRoute,
    getPublishedHomeCuration,
  };
}
