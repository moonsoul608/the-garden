import "server-only";

import type {
  ContentQuery,
  PublicContentCard,
  PublicContentDetail,
  PublicContentRouteDisposition,
  PublicHomeCurationItem,
  RegionName,
} from "@/types";
import { createPublicServerClient } from "@/lib/supabase/public-server";

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
import {
  getDatabaseModeValidationProbes,
  resolveContentSourceConfiguration,
  validateDatabaseMode,
  type ContentSourceMode,
  type DatabaseModeValidationProbes,
  type SourceCutoverEnvironment,
} from "./source-cutover";

export type { ContentSourceMode } from "./source-cutover";

export interface PublicContentService {
  getPublishedContent(query?: ContentQuery): Promise<PublicContentCard[]>;
  getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null>;
  getPublicContentRouteDisposition(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentRouteDisposition>;
  getPublishedHomeCuration(): Promise<PublicHomeCurationItem[]>;
}

export type ContentServiceDependencies = {
  mode?: ContentSourceMode;
  environment?: SourceCutoverEnvironment;
  repository?: ContentRepository;
  repositoryFactory?: () => Promise<ContentRepository>;
  legacySource?: LegacyContentSource;
  /** Injected modes opt into validation explicitly; environment database mode always validates. */
  databaseModeValidation?: DatabaseModeValidationProbes | false;
};

export function getContentSourceMode(
  environment:
    | SourceCutoverEnvironment
    | string = process.env as unknown as SourceCutoverEnvironment,
): ContentSourceMode {
  if (typeof environment === "string") {
    if (
      environment === "legacy" ||
      environment === "dual" ||
      environment === "database"
    ) {
      return environment;
    }
    throw new ContentServiceError(
      "invalid_source_mode",
      "CONTENT_SOURCE_MODE must be legacy, dual, or database.",
      "resolveContentSourceMode",
    );
  }
  return resolveContentSourceConfiguration(environment).mode;
}

function mapRepositoryContent(item: RepositoryContent): PublicContentCard {
  return mapContentRecordToPublicCard(
    mapContentDatabaseRow(item.row, item.tags),
  );
}

function isPublishedRepositoryContent(item: RepositoryContent): boolean {
  return item.row.lifecycle === "Published";
}

function mapRepositoryDetail(
  item: RepositoryContentDetail,
): PublicContentDetail {
  if (!isPublishedRepositoryContent(item)) {
    throw new ContentRepositoryError("mapUnpublishedPublicContentDetail");
  }

  const content = mapContentDatabaseRow(item.row, item.tags);
  const growthNotes = item.growthNotes.map(mapGrowthNoteDatabaseRow);
  const relations = item.relations
    .filter(({ target }) => target.lifecycle === "Published")
    .map((relation) => mapRepositoryRelationToPublic(relation));

  return mapContentRecordToPublicDetail(content, growthNotes, relations);
}

function routeKey(item: Pick<PublicContentCard, "region" | "slug">): string {
  return `${item.region}/${item.slug}`;
}

function deduplicateByRoute(
  items: readonly PublicContentCard[],
): PublicContentCard[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = routeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const client = createPublicServerClient();
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
  const environment =
    dependencies.environment ??
    (process.env as unknown as SourceCutoverEnvironment);
  const sourceConfiguration =
    dependencies.mode === undefined
      ? resolveContentSourceConfiguration(environment)
      : null;
  const mode = dependencies.mode ?? sourceConfiguration!.mode;
  const databaseModeValidation =
    dependencies.databaseModeValidation ??
    (sourceConfiguration?.transition === "dual->database"
      ? getDatabaseModeValidationProbes(environment)
      : false);
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

  let databaseValidationPromise: Promise<void> | null = null;

  async function getValidatedRepository(): Promise<ContentRepository> {
    try {
      const repository = await getRepository();
      if (mode === "database" && databaseModeValidation) {
        databaseValidationPromise ??= validateDatabaseMode(
          repository,
          databaseModeValidation,
        );
        await databaseValidationPromise;
      }
      return repository;
    } catch (error) {
      if (
        error instanceof ContentServiceError &&
        error.code === "database_validation_failed"
      ) {
        throw error;
      }
      throw new ContentServiceError(
        "database_validation_failed",
        "The database public content source is not ready.",
        "validateDatabaseAdapter",
      );
    }
  }

  async function getPublishedContent(
    query: ContentQuery = {},
  ): Promise<PublicContentCard[]> {
    if (query.lifecycles && !query.lifecycles.includes("Published")) {
      return [];
    }

    if (mode === "legacy") {
      return legacySource.getPublishedContent(query);
    }

    const repository =
      mode === "database"
        ? await getValidatedRepository()
        : await getRepository();
    if (mode === "database") {
      const items = await repository.getPublishedContent(query);
      return items
        .filter(isPublishedRepositoryContent)
        .map(mapRepositoryContent);
    }

    const unboundedQuery: ContentQuery = {
      ...query,
      limit: undefined,
      offset: undefined,
    };
    // The database must first authorize which identities are safe to fall
    // back. If it is unavailable, do not read or resurrect legacy records.
    const databaseItems = await repository.getPublishedContent(unboundedQuery);
    const legacyItems = await legacySource.getPublishedContent(unboundedQuery);
    const mappedDatabaseItems = deduplicateByRoute(
      databaseItems
        .filter(isPublishedRepositoryContent)
        .map(mapRepositoryContent),
    );
    const migratedRoutes = new Set(mappedDatabaseItems.map(routeKey));
    const fallbackCandidates = deduplicateByRoute(legacyItems).filter(
      (item) => !migratedRoutes.has(routeKey(item)),
    );
    const unmigratedRoutes = await repository.getUnmigratedRouteKeys(
      fallbackCandidates.map(({ region, slug }) => ({ region, slug })),
    );
    const merged = deduplicateByRoute([
      ...mappedDatabaseItems,
      ...fallbackCandidates.filter((item) =>
        unmigratedRoutes.has(routeKey(item)),
      ),
    ]);

    return applyWindow(merged, query);
  }

  async function getPublishedContentByRoute(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentDetail | null> {
    const disposition = await getPublicContentRouteDisposition(region, slug);
    return disposition.kind === "published" ? disposition.content : null;
  }

  async function getPublicContentRouteDisposition(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentRouteDisposition> {
    if (mode === "legacy") {
      const content = await legacySource.getPublishedContentByRoute(
        region,
        slug,
      );
      return content
        ? { kind: "published", content }
        : { kind: "not_found" };
    }

    const repository =
      mode === "database"
        ? await getValidatedRepository()
        : await getRepository();

    // A database-only Published route can be resolved directly through the
    // RLS-constrained detail query. Non-Published identities still use the
    // disposition RPC so Archived resting states and hidden lifecycle routes
    // remain explicit. Dual mode must always authorize fallback first.
    if (mode === "database") {
      const content = await repository.getPublishedContentByRoute(region, slug);
      if (content) {
        return { kind: "published", content: mapRepositoryDetail(content) };
      }
    }

    const disposition = await repository.resolvePublicContentRoute(
      region,
      slug,
    );

    if (disposition.kind === "archived") {
      return { kind: "archived", content: disposition.content };
    }

    if (disposition.kind === "published") {
      const content = await repository.getPublishedContentByRoute(region, slug);
      if (!content) {
        throw new ContentRepositoryError("readResolvedPublishedContentByRoute");
      }
      return { kind: "published", content: mapRepositoryDetail(content) };
    }

    if (mode === "dual" && disposition.legacyFallbackAllowed) {
      const content = await legacySource.getPublishedContentByRoute(
        region,
        slug,
      );
      if (content) return { kind: "published", content };
    }

    return { kind: "not_found" };
  }

  async function getPublishedHomeCuration(): Promise<
    PublicHomeCurationItem[]
  > {
    if (mode === "legacy") {
      return legacySource.getPublishedHomeCuration();
    }

    const repository =
      mode === "database"
        ? await getValidatedRepository()
        : await getRepository();
    const rows = await repository.getPublishedHomeCuration();

    // Dual mode deliberately has no legacy Home fallback while its conflicts
    // and display overrides remain deferred.
    return rows
      .filter(({ content }) => isPublishedRepositoryContent(content))
      .map(({ row, content }) =>
        mapHomeCurationToPublic(
          row,
          mapContentDatabaseRow(content.row, content.tags),
        ),
      );
  }

  return {
    getPublishedContent,
    getPublishedContentByRoute,
    getPublicContentRouteDisposition,
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

export function getPublicContentRouteDisposition(
  region: RegionName,
  slug: string,
): Promise<PublicContentRouteDisposition> {
  return getDefaultService().getPublicContentRouteDisposition(region, slug);
}

export function getPublishedHomeCuration(): Promise<
  PublicHomeCurationItem[]
> {
  return getDefaultService().getPublishedHomeCuration();
}
