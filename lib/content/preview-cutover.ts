import "server-only";

import type { Metadata } from "next";

import type { PublicContentService } from "./service";
import { createContentService } from "./service";
import type { ContentRepository } from "./repository";
import {
  createPublicRouteIntegration,
} from "./public-route-integration";
import { presentPublicContentCards } from "./public-presentation";
import { resolveContentSourceConfiguration } from "./source-cutover";
import type { RegionName } from "@/types";

export const PREVIEW_CUTOVER_ROUTE_MANIFEST = {
  Garden: [
    "building-the-garden",
    "learning-psychological-statistics",
    "exploring-ai-tools",
    "python-starting-from-the-basics",
    "designing-better-slides-and-documents",
  ],
  Forest: [
    "why-exploratory-websites-invite-more-clicks",
    "does-ai-help-thinking-or-organize-answers",
    "why-people-fear-forgetting",
    "how-psychology-shapes-product-and-web-design",
    "when-a-question-moves-from-forest-to-garden",
  ],
  Lake: [
    "reverse-1999",
    "jung-and-mandala",
    "the-garden",
    "love-love-love",
    "summer-ghost",
  ],
  Ruins: [
    "first-version-of-home",
    "portfolio-never-built",
    "too-much-interaction",
    "unfinished-continue",
  ],
} as const satisfies Record<RegionName, readonly string[]>;

export const PREVIEW_CUTOVER_RELATIONS = [
  ["first-version-of-home", "building-the-garden"],
  ["portfolio-never-built", "the-garden"],
  ["too-much-interaction", "why-exploratory-websites-invite-more-clicks"],
  ["unfinished-continue", "why-people-fear-forgetting"],
] as const;

export const PREVIEW_CUTOVER_PUBLIC_SURFACES = [
  "home",
  "garden",
  "forest",
  "lake",
  "ruins",
  "search",
  "garden-index",
] as const;

export const PREVIEW_CUTOVER_ROLLBACK_PATH = [
  "database",
  "dual",
  "legacy",
] as const;

export type PreviewLifecycleControls = {
  draft: { region: RegionName; slug: string };
  review: { region: RegionName; slug: string };
  archived: { region: RegionName; slug: string };
};

export type PreviewCutoverCheckId =
  | "preview_scope"
  | "database_default_active"
  | "database_no_legacy_fallback"
  | "public_surfaces"
  | "detail_routes"
  | "metadata"
  | "sitemap"
  | "lifecycle_visibility"
  | "relations"
  | "lake_null_growth_stage"
  | "rollback_path";

export type PreviewCutoverVerificationResult = {
  schemaVersion: 1;
  kind: "preview-database-cutover-verification";
  status: "VERIFIED" | "BLOCKED";
  previewOnly: true;
  cutoverExecuted: false;
  productionCutoverAuthorized: false;
  defaultSourceModeChanged: false;
  publicSurfaceCount: number;
  detailRouteCount: number;
  checks: Array<{ id: PreviewCutoverCheckId; status: "PASS" | "BLOCKED" }>;
  blockingCheckIds: PreviewCutoverCheckId[];
};

type VerificationDependencies = {
  deploymentEnvironment: "preview" | "production" | "development";
  repository: ContentRepository;
  lifecycleControls: PreviewLifecycleControls;
};

const regions = Object.keys(PREVIEW_CUTOVER_ROUTE_MANIFEST) as RegionName[];
const expectedRoutes = regions.flatMap((region) =>
  PREVIEW_CUTOVER_ROUTE_MANIFEST[region].map((slug) => ({ region, slug })),
);
const expectedRouteKeys = new Set(
  expectedRoutes.map(({ region, slug }) => `${region}/${slug}`),
);
const homeRouteKeys = new Set([
  "Garden/building-the-garden",
  "Garden/learning-psychological-statistics",
  "Garden/exploring-ai-tools",
  "Forest/why-people-fear-forgetting",
]);

function metadataIsPublic(metadata: Metadata, title: string, path: string) {
  return (
    metadata.title === title &&
    metadata.description !== undefined &&
    metadata.alternates?.canonical === path &&
    metadata.robots !== undefined &&
    metadata.robots !== null &&
    typeof metadata.robots !== "string" &&
    metadata.robots.index === true &&
    metadata.openGraph?.title === title &&
    metadata.openGraph?.url === path
  );
}

function rollbackConfigurationIsReady() {
  const databaseToDual = resolveContentSourceConfiguration({
    CONTENT_SOURCE_MODE: "dual",
    CONTENT_SOURCE_PREVIOUS_MODE: "database",
    CONTENT_SOURCE_MODE_CONFIRM: "dual",
  });
  const dualToLegacy = resolveContentSourceConfiguration({
    CONTENT_SOURCE_MODE: "legacy",
    CONTENT_SOURCE_PREVIOUS_MODE: "dual",
    CONTENT_SOURCE_MODE_CONFIRM: "legacy",
  });
  let directRollbackRejected = false;
  try {
    resolveContentSourceConfiguration({
      CONTENT_SOURCE_MODE: "legacy",
      CONTENT_SOURCE_PREVIOUS_MODE: "database",
      CONTENT_SOURCE_MODE_CONFIRM: "legacy",
    });
  } catch {
    directRollbackRejected = true;
  }

  return (
    databaseToDual.transition === "database->dual" &&
    dualToLegacy.transition === "dual->legacy" &&
    directRollbackRejected
  );
}

/**
 * Read-only cutover verification. It resolves an absent source environment
 * through the post-cutover default and never mutates process configuration.
 */
export async function verifyPreviewDatabaseCutover({
  deploymentEnvironment,
  repository,
  lifecycleControls,
}: VerificationDependencies): Promise<PreviewCutoverVerificationResult> {
  let legacyReads = 0;
  const service: PublicContentService = createContentService({
    environment: {},
    databaseModeValidation: false,
    repository,
    legacySource: {
      getPublishedContent: async () => {
        legacyReads += 1;
        return [];
      },
      getPublishedContentByRoute: async () => {
        legacyReads += 1;
        return null;
      },
      getPublishedHomeCuration: async () => {
        legacyReads += 1;
        return [];
      },
    },
  });
  const integration = createPublicRouteIntegration({
    readRoute: service.getPublicContentRouteDisposition,
    listPublished: service.getPublishedContent,
  });
  const allItems = await service.getPublishedContent();
  const routeKeys = new Set(
    allItems.map(({ region, slug }) => `${region}/${slug}`),
  );
  const presentations = presentPublicContentCards(allItems);

  const regionSurfacesPass = await Promise.all(
    regions.map(async (region) => {
      const items = await service.getPublishedContent({ regions: [region] });
      return (
        items.length === PREVIEW_CUTOVER_ROUTE_MANIFEST[region].length &&
        items.every(
          ({ slug, region: itemRegion }) =>
            itemRegion === region &&
            (PREVIEW_CUTOVER_ROUTE_MANIFEST[region] as readonly string[]).includes(
              slug,
            ),
        )
      );
    }),
  );
  const publicSurfacesPass =
    regionSurfacesPass.every(Boolean) &&
    allItems.length === expectedRoutes.length &&
    routeKeys.size === expectedRouteKeys.size &&
    [...expectedRouteKeys].every((key) => routeKeys.has(key)) &&
    [...homeRouteKeys].every((key) => routeKeys.has(key)) &&
    presentations.length === expectedRoutes.length &&
    presentations.every(
      (item) =>
        item.title.trim() &&
        item.summary.trim() &&
        item.cta.trim() &&
        item.primaryCategories.length > 0,
    );

  const detailResults = await Promise.all(
    expectedRoutes.map(async ({ region, slug }) => {
      const disposition = await integration.resolve(region, slug);
      if (disposition.kind !== "published") return null;
      const metadata = await integration.metadata(region, slug);
      return { disposition, metadata };
    }),
  );
  const detailRoutesPass = detailResults.every(
    (result, index) =>
      result?.disposition.content.region === expectedRoutes[index].region &&
      result.disposition.content.slug === expectedRoutes[index].slug &&
      result.disposition.content.bodyMarkdown.trim() &&
      result.disposition.content.title.trim() &&
      result.disposition.content.summary.trim(),
  );
  const metadataPass = detailResults.every((result, index) => {
    if (!result) return false;
    const { region, slug } = expectedRoutes[index];
    return metadataIsPublic(
      result.metadata,
      result.disposition.content.title,
      `/${region.toLowerCase()}/${slug}`,
    );
  });

  const sitemap = await integration.sitemap(new URL("https://preview.garden.test"));
  const sitemapPaths = new Set(
    sitemap.map(({ url }) => new URL(url).pathname),
  );
  const sitemapPass =
    sitemap.length === expectedRoutes.length &&
    sitemapPaths.size === expectedRoutes.length &&
    expectedRoutes.every(({ region, slug }) =>
      sitemapPaths.has(`/${region.toLowerCase()}/${slug}`),
    );

  const [draft, review, archived] = await Promise.all([
    integration.resolve(lifecycleControls.draft.region, lifecycleControls.draft.slug),
    integration.resolve(lifecycleControls.review.region, lifecycleControls.review.slug),
    integration.resolve(
      lifecycleControls.archived.region,
      lifecycleControls.archived.slug,
    ),
  ]);
  const hiddenControlKeys = Object.values(lifecycleControls).map(
    ({ region, slug }) => `${region}/${slug}`,
  );
  const lifecycleVisibilityPass =
    draft.kind === "not_found" &&
    review.kind === "not_found" &&
    archived.kind === "archived" &&
    hiddenControlKeys.every((key) => !routeKeys.has(key)) &&
    Object.values(lifecycleControls).every(
      ({ region, slug }) =>
        !sitemapPaths.has(`/${region.toLowerCase()}/${slug}`),
    );

  const loadedRelations = detailResults.flatMap((result) =>
    result?.disposition.kind === "published"
      ? result.disposition.content.relations.map((relation) => [
          result.disposition.content.slug,
          relation.target.slug,
        ] as const)
      : [],
  );
  const relationsPass =
    loadedRelations.length === PREVIEW_CUTOVER_RELATIONS.length &&
    PREVIEW_CUTOVER_RELATIONS.every(([source, target]) =>
      loadedRelations.some(
        ([actualSource, actualTarget]) =>
          source === actualSource && target === actualTarget,
      ),
    );
  const lakeNullPass = detailResults.every((result, index) => {
    const content = result?.disposition.content;
    return expectedRoutes[index].region === "Lake"
      ? content?.growthStage === null
      : content?.growthStage !== null;
  });

  const passed: Record<PreviewCutoverCheckId, boolean> = {
    preview_scope: deploymentEnvironment === "preview",
    database_default_active:
      resolveContentSourceConfiguration({}).mode === "database",
    database_no_legacy_fallback: legacyReads === 0,
    public_surfaces: publicSurfacesPass,
    detail_routes: detailRoutesPass,
    metadata: metadataPass,
    sitemap: sitemapPass,
    lifecycle_visibility: lifecycleVisibilityPass,
    relations: relationsPass,
    lake_null_growth_stage: lakeNullPass,
    rollback_path: rollbackConfigurationIsReady(),
  };
  const checks = (Object.keys(passed) as PreviewCutoverCheckId[]).map((id) => ({
    id,
    status: passed[id] ? ("PASS" as const) : ("BLOCKED" as const),
  }));
  const blockingCheckIds = checks
    .filter(({ status }) => status === "BLOCKED")
    .map(({ id }) => id);

  return {
    schemaVersion: 1,
    kind: "preview-database-cutover-verification",
    status: blockingCheckIds.length === 0 ? "VERIFIED" : "BLOCKED",
    previewOnly: true,
    cutoverExecuted: false,
    productionCutoverAuthorized: false,
    defaultSourceModeChanged: false,
    publicSurfaceCount: PREVIEW_CUTOVER_PUBLIC_SURFACES.length,
    detailRouteCount: expectedRoutes.length,
    checks,
    blockingCheckIds,
  };
}
