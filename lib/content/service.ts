import "server-only";

import type {
  AdminContentRecord,
  ContentLanguage,
  ContentQuery,
  ContentType,
  CoverMetadata,
  DetailLevel,
  GrowthStage,
  PublicContentCard,
  PublicContentDetail,
  PublicHomeCurationItem,
  RegionName,
} from "@/types";
import { createClient } from "@/lib/supabase/server";

import type { ContentValidationResult } from "./errors";
import { ContentRepositoryError, ContentServiceError } from "./errors";
import {
  createLegacyContentSource,
  type LegacyContentSource,
} from "./legacy-source";
import {
  mapContentDatabaseRow,
  mapContentRecordToPublicCard,
  mapContentRecordToPublicDetail,
  mapGrowthNoteDatabaseRow,
  mapHomeCurationToPublic,
  mapRepositoryRelationToPublic,
} from "./mappers";
import {
  createContentRepository,
  type ContentRepository,
  type ContentRepositoryClient,
  type RepositoryContent,
  type RepositoryContentDetail,
} from "./repository";

export type ContentSourceMode = "legacy" | "dual" | "database";

export interface PublicContentService {
  getPublishedContent(query?: ContentQuery): Promise<PublicContentCard[]>;
  getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null>;
  getPublishedHomeCuration(): Promise<PublicHomeCurationItem[]>;
}

export type CreateDraftInput = {
  slug?: string | null;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  growthStage: GrowthStage;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh?: string | null;
  summaryEn?: string | null;
  bodyZhMarkdown?: string | null;
  bodyEnMarkdown?: string | null;
  contentLanguage: ContentLanguage;
  primaryCategories?: string[];
  tags?: string[];
  cover?: CoverMetadata | null;
};

export type UpdateDraftInput = {
  contentId: string;
  changes: Partial<CreateDraftInput>;
};

export type PublicationPreparation = {
  content: AdminContentRecord;
  validation: ContentValidationResult;
  ready: boolean;
};

/** Phase 03B defines these write contracts but intentionally implements none. */
export interface AdminContentService {
  createDraft(input: CreateDraftInput): Promise<AdminContentRecord>;
  updateDraft(input: UpdateDraftInput): Promise<AdminContentRecord>;
  preparePublication(contentId: string): Promise<PublicationPreparation>;
}

export type ContentServiceDependencies = {
  mode?: ContentSourceMode;
  repository?: ContentRepository;
  repositoryFactory?: () => Promise<ContentRepository>;
  legacySource?: LegacyContentSource;
};

export function getContentSourceMode(
  value = process.env.CONTENT_SOURCE_MODE,
): ContentSourceMode {
  if (!value) return "legacy";
  if (value === "legacy" || value === "dual" || value === "database") {
    return value;
  }

  throw new ContentServiceError(
    "invalid_source_mode",
    "CONTENT_SOURCE_MODE must be legacy, dual, or database.",
    "resolveContentSourceMode",
  );
}

function mapRepositoryContent(item: RepositoryContent): PublicContentCard {
  return mapContentRecordToPublicCard(
    mapContentDatabaseRow(item.row, item.tags),
  );
}

function mapRepositoryDetail(
  item: RepositoryContentDetail,
): PublicContentDetail {
  const content = mapContentDatabaseRow(item.row, item.tags);
  const growthNotes = item.growthNotes.map(mapGrowthNoteDatabaseRow);
  const relations = item.relations.map((relation) =>
    mapRepositoryRelationToPublic(relation),
  );

  return mapContentRecordToPublicDetail(content, growthNotes, relations);
}

function routeKey(item: Pick<PublicContentCard, "region" | "slug">): string {
  return `${item.region}/${item.slug}`;
}

function applyWindow(
  items: PublicContentCard[],
  query: ContentQuery,
): PublicContentCard[] {
  const offset = Math.max(0, query.offset ?? 0);
  return query.limit === undefined
    ? items.slice(offset)
    : items.slice(offset, offset + Math.max(0, query.limit));
}

async function createDefaultRepository(): Promise<ContentRepository> {
  try {
    const client = await createClient();
    return createContentRepository(
      client as unknown as ContentRepositoryClient,
    );
  } catch (error) {
    if (error instanceof ContentServiceError) throw error;
    throw new ContentRepositoryError("createSupabaseContentRepository");
  }
}

export function createContentService(
  dependencies: ContentServiceDependencies = {},
): PublicContentService {
  const mode = dependencies.mode ?? getContentSourceMode();
  const legacySource =
    dependencies.legacySource ?? createLegacyContentSource();
  let repositoryPromise: Promise<ContentRepository> | null =
    dependencies.repository
      ? Promise.resolve(dependencies.repository)
      : null;

  function getRepository(): Promise<ContentRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function getPublishedContent(
    query: ContentQuery = {},
  ): Promise<PublicContentCard[]> {
    if (mode === "legacy") {
      return legacySource.getPublishedContent(query);
    }

    const repository = await getRepository();
    if (mode === "database") {
      const items = await repository.getPublishedContent(query);
      return items.map(mapRepositoryContent);
    }

    const unboundedQuery: ContentQuery = {
      ...query,
      limit: undefined,
      offset: undefined,
    };
    const [databaseItems, legacyItems] = await Promise.all([
      repository.getPublishedContent(unboundedQuery),
      legacySource.getPublishedContent(unboundedQuery),
    ]);
    const mappedDatabaseItems = databaseItems.map(mapRepositoryContent);
    const migratedRoutes = new Set(mappedDatabaseItems.map(routeKey));
    const merged = [
      ...mappedDatabaseItems,
      ...legacyItems.filter((item) => !migratedRoutes.has(routeKey(item))),
    ];

    return applyWindow(merged, query);
  }

  async function getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null> {
    if (mode === "legacy") {
      return legacySource.getPublishedContentByRoute(region, slug);
    }

    const repository = await getRepository();
    const databaseItem = await repository.getPublishedContentByRoute(
      region,
      slug,
    );
    if (databaseItem) return mapRepositoryDetail(databaseItem);

    return mode === "dual"
      ? legacySource.getPublishedContentByRoute(region, slug)
      : null;
  }

  async function getPublishedHomeCuration(): Promise<
    PublicHomeCurationItem[]
  > {
    if (mode === "legacy") {
      return legacySource.getPublishedHomeCuration();
    }

    const repository = await getRepository();
    const rows = await repository.getPublishedHomeCuration();

    // Dual mode deliberately has no legacy Home fallback while its conflicts
    // and display overrides remain deferred.
    return rows.map(({ row, content }) =>
      mapHomeCurationToPublic(
        row,
        mapContentDatabaseRow(content.row, content.tags),
      ),
    );
  }

  return {
    getPublishedContent,
    getPublishedContentByRoute,
    getPublishedHomeCuration,
  };
}

let defaultService: PublicContentService | null = null;

function getDefaultService(): PublicContentService {
  defaultService ??= createContentService();
  return defaultService;
}

export function getPublishedContent(
  query?: ContentQuery,
): Promise<PublicContentCard[]> {
  return getDefaultService().getPublishedContent(query);
}

export function getPublishedContentByRoute(
  region: RegionName,
  slug: string,
): Promise<PublicContentDetail | null> {
  return getDefaultService().getPublishedContentByRoute(region, slug);
}

export function getPublishedHomeCuration(): Promise<
  PublicHomeCurationItem[]
> {
  return getDefaultService().getPublishedHomeCuration();
}
