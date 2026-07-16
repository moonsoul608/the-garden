import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContentDatabase,
  ContentRelationDatabaseRow,
  GrowthNoteDatabaseRow,
  HomeCurationDatabaseRow,
  PublicContentDatabaseRow,
} from "@/types/database";
import type {
  ContentQuery,
  GrowthStage,
  Lifecycle,
  PublicArchivedContent,
  RegionName,
  RelationType,
} from "@/types";

import { ContentRepositoryError } from "./errors";

const PUBLIC_CONTENT_COLUMNS = [
  "id",
  "slug",
  "region",
  "content_type",
  "detail_level",
  "lifecycle",
  "growth_stage",
  "title_zh",
  "title_en",
  "summary_zh",
  "summary_en",
  "body_zh_markdown",
  "body_en_markdown",
  "content_language",
  "primary_categories",
  "cover_image_path",
  "cover_image_alt_zh",
  "cover_image_alt_en",
  "featured",
  "manual_order",
  "created_at",
  "updated_at",
  "published_at",
  "archived_at",
  "last_tended_at",
].join(",");

export type RepositoryContent = {
  row: PublicContentDatabaseRow;
  tags: string[];
};

export type RepositoryContentDetail = RepositoryContent & {
  growthNotes: GrowthNoteDatabaseRow[];
  relations: Array<{
    relation: ContentRelationDatabaseRow;
    target: PublicContentDatabaseRow;
  }>;
};

export type RepositoryHomeCuration = {
  row: HomeCurationDatabaseRow;
  content: RepositoryContent;
};

export type ContentRouteIdentity = {
  region: RegionName;
  slug: string;
};

export type RepositoryRouteDisposition =
  | { kind: "published" }
  | { kind: "archived"; content: PublicArchivedContent }
  | { kind: "not_found"; legacyFallbackAllowed: boolean };

export interface ContentRepository {
  getPublishedContent(query?: ContentQuery): Promise<RepositoryContent[]>;
  getPublishedContentByRoute(
    region: PublicContentDatabaseRow["region"],
    slug: string,
  ): Promise<RepositoryContentDetail | null>;
  resolvePublicContentRoute(
    region: RegionName,
    slug: string,
  ): Promise<RepositoryRouteDisposition>;
  getUnmigratedRouteKeys(
    routes: readonly ContentRouteIdentity[],
  ): Promise<Set<string>>;
  getPublishedHomeCuration(): Promise<RepositoryHomeCuration[]>;
}

type ContentRepositoryClient = SupabaseClient<ContentDatabase>;

function assertNoRepositoryError(error: unknown, operation: string): void {
  if (error) {
    throw new ContentRepositoryError(operation);
  }
}

function normalizeSearchTerm(value: string): string {
  return value.trim().replace(/[%_,().]/g, " ").replace(/\s+/g, " ");
}

function normalizeTag(value: string): string {
  return value.trim().toLocaleLowerCase();
}

const REGIONS = new Set<RegionName>(["Garden", "Forest", "Lake", "Ruins"]);
const GROWTH_STAGES = new Set<GrowthStage>([
  "Seed",
  "Sprout",
  "Growing",
  "Bloom",
  "Dormant",
]);
const RELATION_TYPES = new Set<RelationType>([
  "grewFrom",
  "grewInto",
  "relatedTo",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArchivedContent(value: unknown): PublicArchivedContent {
  if (!isRecord(value)) {
    throw new ContentRepositoryError("resolvePublicContentRoute");
  }

  const { title, region, growthStage, lifecycle, restingState } = value;
  if (
    typeof title !== "string" ||
    !REGIONS.has(region as RegionName) ||
    !GROWTH_STAGES.has(growthStage as GrowthStage) ||
    lifecycle !== "Archived" ||
    restingState !== "archived" ||
    !Array.isArray(value.relations)
  ) {
    throw new ContentRepositoryError("resolvePublicContentRoute");
  }

  const relations = value.relations.map((relation) => {
    if (!isRecord(relation) || !isRecord(relation.target)) {
      throw new ContentRepositoryError("resolvePublicContentRoute");
    }

    const relationType = relation.relationType;
    const target = relation.target;
    if (
      !RELATION_TYPES.has(relationType as RelationType) ||
      typeof target.slug !== "string" ||
      !REGIONS.has(target.region as RegionName) ||
      !GROWTH_STAGES.has(target.growthStage as GrowthStage) ||
      typeof target.title !== "string"
    ) {
      throw new ContentRepositoryError("resolvePublicContentRoute");
    }

    return {
      relationType: relationType as RelationType,
      target: {
        slug: target.slug,
        region: target.region as RegionName,
        growthStage: target.growthStage as GrowthStage,
        title: target.title,
      },
    };
  });

  return {
    title,
    region: region as RegionName,
    growthStage: growthStage as GrowthStage,
    lifecycle: "Archived",
    restingState: "archived",
    relations,
  };
}

function parseRouteDisposition(value: unknown): RepositoryRouteDisposition {
  if (!isRecord(value)) {
    throw new ContentRepositoryError("resolvePublicContentRoute");
  }

  if (value.disposition === "published") return { kind: "published" };
  if (value.disposition === "archived") {
    return { kind: "archived", content: parseArchivedContent(value.content) };
  }
  if (value.disposition === "not_found") {
    if (
      value.legacyFallback !== "allowed" &&
      value.legacyFallback !== "forbidden"
    ) {
      throw new ContentRepositoryError("resolvePublicContentRoute");
    }
    return {
      kind: "not_found",
      legacyFallbackAllowed: value.legacyFallback === "allowed",
    };
  }

  throw new ContentRepositoryError("resolvePublicContentRoute");
}

function contentRouteKey(route: ContentRouteIdentity): string {
  return `${route.region}/${route.slug}`;
}

export function createContentRepository(
  client: ContentRepositoryClient,
): ContentRepository {
  async function getTagMap(
    rows: readonly PublicContentDatabaseRow[],
  ): Promise<Map<string, string[]>> {
    const tagMap = new Map<string, string[]>();
    const contentIds = rows.map((row) => row.id);

    if (contentIds.length === 0) {
      return tagMap;
    }

    const bindingResult = await client
      .from("content_tags")
      .select("content_id,tag_id")
      .in("content_id", contentIds);
    assertNoRepositoryError(bindingResult.error, "readContentTagBindings");

    const bindings = bindingResult.data ?? [];
    const tagIds = [...new Set(bindings.map((binding) => binding.tag_id))];

    if (tagIds.length === 0) {
      return tagMap;
    }

    const tagResult = await client
      .from("tags")
      .select("id,display_name")
      .in("id", tagIds);
    assertNoRepositoryError(tagResult.error, "readContentTags");

    const tagNames = new Map(
      (tagResult.data ?? []).map((tag) => [tag.id, tag.display_name]),
    );

    for (const binding of bindings) {
      const displayName = tagNames.get(binding.tag_id);
      if (!displayName) continue;

      const names = tagMap.get(binding.content_id) ?? [];
      names.push(displayName);
      tagMap.set(binding.content_id, names);
    }

    return tagMap;
  }

  async function resolveContentIdsForTags(
    tags: readonly string[],
  ): Promise<string[]> {
    const normalizedTags = tags.map(normalizeTag).filter(Boolean);
    if (normalizedTags.length === 0) return [];

    const tagResult = await client
      .from("tags")
      .select("id")
      .in("normalized_name", normalizedTags);
    assertNoRepositoryError(tagResult.error, "resolveTagFilters");

    const tagIds = (tagResult.data ?? []).map((tag) => tag.id);
    if (tagIds.length === 0) return [];

    const bindingResult = await client
      .from("content_tags")
      .select("content_id")
      .in("tag_id", tagIds);
    assertNoRepositoryError(bindingResult.error, "resolveTaggedContent");

    return [
      ...new Set((bindingResult.data ?? []).map((binding) => binding.content_id)),
    ];
  }

  async function getPublishedContent(
    query: ContentQuery = {},
  ): Promise<RepositoryContent[]> {
    if (
      query.lifecycles &&
      !query.lifecycles.includes("Published" satisfies Lifecycle)
    ) {
      return [];
    }

    const taggedContentIds = query.tags?.length
      ? await resolveContentIdsForTags(query.tags)
      : null;
    if (taggedContentIds?.length === 0) return [];

    let request = client
      .from("contents")
      .select(PUBLIC_CONTENT_COLUMNS)
      .eq("lifecycle", "Published");

    if (query.regions?.length) {
      request = request.in("region", query.regions);
    }
    if (query.contentTypes?.length) {
      request = request.in("content_type", query.contentTypes);
    }
    if (query.growthStages?.length) {
      request = request.in("growth_stage", query.growthStages);
    }
    if (query.primaryCategories?.length) {
      request = request.overlaps(
        "primary_categories",
        query.primaryCategories,
      );
    }
    if (query.featured !== undefined) {
      request = request.eq("featured", query.featured);
    }
    if (taggedContentIds) {
      request = request.in("id", taggedContentIds);
    }

    const searchTerm = query.search ? normalizeSearchTerm(query.search) : "";
    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      request = request.or(
        [
          `title_zh.ilike.${pattern}`,
          `title_en.ilike.${pattern}`,
          `summary_zh.ilike.${pattern}`,
          `summary_en.ilike.${pattern}`,
        ].join(","),
      );
    }

    const orderColumn =
      query.orderBy === "publishedAt"
        ? "published_at"
        : query.orderBy === "manualOrder"
          ? "manual_order"
          : "last_tended_at";
    request = request.order(orderColumn, {
      ascending: query.direction === "asc",
      nullsFirst: false,
    });

    if (query.limit !== undefined) {
      const start = query.offset ?? 0;
      request = request.range(start, start + Math.max(0, query.limit - 1));
    }

    const result = await request;
    assertNoRepositoryError(result.error, "readPublishedContent");

    const rows = (result.data ?? []) as unknown as PublicContentDatabaseRow[];
    const tagMap = await getTagMap(rows);

    return rows.map((row) => ({
      row,
      tags: tagMap.get(row.id) ?? [],
    }));
  }

  async function getPublishedContentByRoute(
    region: PublicContentDatabaseRow["region"],
    slug: string,
  ): Promise<RepositoryContentDetail | null> {
    const contentResult = await client
      .from("contents")
      .select(PUBLIC_CONTENT_COLUMNS)
      .eq("lifecycle", "Published")
      .eq("region", region)
      .eq("slug", slug)
      .maybeSingle();
    assertNoRepositoryError(contentResult.error, "readPublishedContentByRoute");

    if (!contentResult.data) return null;

    const row = contentResult.data as unknown as PublicContentDatabaseRow;
    const [tagMap, growthResult, relationResult] = await Promise.all([
      getTagMap([row]),
      client
        .from("growth_notes")
        .select("*")
        .eq("content_id", row.id)
        .eq("is_public", true)
        .order("occurred_at", { ascending: false }),
      client
        .from("content_relations")
        .select("*")
        .eq("source_content_id", row.id),
    ]);

    assertNoRepositoryError(growthResult.error, "readPublicGrowthNotes");
    assertNoRepositoryError(relationResult.error, "readPublicContentRelations");

    const relationRows = (relationResult.data ?? []) as ContentRelationDatabaseRow[];
    const targetIds = [
      ...new Set(relationRows.map((relation) => relation.target_content_id)),
    ];
    let targetRows: PublicContentDatabaseRow[] = [];

    if (targetIds.length > 0) {
      const targetResult = await client
        .from("contents")
        .select(PUBLIC_CONTENT_COLUMNS)
        .eq("lifecycle", "Published")
        .in("id", targetIds);
      assertNoRepositoryError(targetResult.error, "readRelationTargets");
      targetRows = (targetResult.data ?? []) as unknown as PublicContentDatabaseRow[];
    }

    const targets = new Map(targetRows.map((target) => [target.id, target]));

    return {
      row,
      tags: tagMap.get(row.id) ?? [],
      growthNotes: (growthResult.data ?? []) as GrowthNoteDatabaseRow[],
      relations: relationRows.flatMap((relation) => {
        const target = targets.get(relation.target_content_id);
        return target ? [{ relation, target }] : [];
      }),
    };
  }

  async function resolvePublicContentRoute(
    region: RegionName,
    slug: string,
  ): Promise<RepositoryRouteDisposition> {
    const result = await client.rpc("resolve_public_content_route", {
      p_region: region,
      p_slug: slug,
    });
    assertNoRepositoryError(result.error, "resolvePublicContentRoute");
    return parseRouteDisposition(result.data);
  }

  async function getUnmigratedRouteKeys(
    routes: readonly ContentRouteIdentity[],
  ): Promise<Set<string>> {
    if (routes.length === 0) return new Set();

    const requestedKeys = new Set(routes.map(contentRouteKey));
    const result = await client.rpc("filter_unmigrated_public_routes", {
      p_routes: routes.map(({ region, slug }) => ({ region, slug })),
    });
    assertNoRepositoryError(result.error, "filterUnmigratedPublicRoutes");

    if (!Array.isArray(result.data)) {
      throw new ContentRepositoryError("filterUnmigratedPublicRoutes");
    }

    const keys = result.data.filter(
      (key): key is string =>
        typeof key === "string" && requestedKeys.has(key),
    );
    return new Set(keys);
  }

  async function getPublishedHomeCuration(): Promise<
    RepositoryHomeCuration[]
  > {
    const curationResult = await client
      .from("home_curation")
      .select("*")
      .order("slot", { ascending: true })
      .order("sort_order", { ascending: true });
    assertNoRepositoryError(curationResult.error, "readPublishedHomeCuration");

    const curationRows = (curationResult.data ?? []) as HomeCurationDatabaseRow[];
    const contentIds = curationRows.map((row) => row.content_id);
    if (contentIds.length === 0) return [];

    const contentResult = await client
      .from("contents")
      .select(PUBLIC_CONTENT_COLUMNS)
      .eq("lifecycle", "Published")
      .in("id", contentIds);
    assertNoRepositoryError(contentResult.error, "readCuratedContent");

    const rows = (contentResult.data ?? []) as unknown as PublicContentDatabaseRow[];
    const tagMap = await getTagMap(rows);
    const content = new Map(
      rows.map((row) => [
        row.id,
        { row, tags: tagMap.get(row.id) ?? [] } satisfies RepositoryContent,
      ]),
    );

    return curationRows.flatMap((row) => {
      const matchedContent = content.get(row.content_id);
      return matchedContent ? [{ row, content: matchedContent }] : [];
    });
  }

  return {
    getPublishedContent,
    getPublishedContentByRoute,
    resolvePublicContentRoute,
    getUnmigratedRouteKeys,
    getPublishedHomeCuration,
  };
}

export type { ContentRepositoryClient };
