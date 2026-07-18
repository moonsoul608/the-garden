import "server-only";

import type { Metadata, MetadataRoute } from "next";
import { cache } from "react";

import type {
  PublicContentCard,
  PublicContentRouteDisposition,
  RegionName,
} from "@/types";

import {
  getPublishedContent,
  getPublicContentRouteDisposition,
} from "./service";
import {
  PUBLIC_CONTENT_REGIONS,
  absolutePublicUrl,
  approvedPublicImageUrl,
  createPublicPageMetadata,
  getSiteOrigin,
  publicContentPath,
} from "@/lib/seo";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type RouteReader = (
  region: RegionName,
  slug: string,
) => Promise<PublicContentRouteDisposition>;

type PublishedReader = (query: {
  regions: RegionName[];
}) => Promise<PublicContentCard[]>;

export type PublicRouteIntegrationDependencies = {
  readRoute: RouteReader;
  listPublished: PublishedReader;
};

export function isValidPublicSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

function dispositionMatchesRoute(
  region: RegionName,
  slug: string,
  disposition: PublicContentRouteDisposition,
): boolean {
  if (disposition.kind === "published") {
    return (
      disposition.content.region === region &&
      disposition.content.slug === slug
    );
  }

  if (disposition.kind === "archived") {
    return disposition.content.region === region;
  }

  return true;
}

function preferredCoverAlt(
  cover: { altZh: string | null; altEn: string | null },
): string | null {
  return cover.altEn?.trim() || cover.altZh?.trim() || null;
}

function publishedMetadata(
  content: Extract<
    PublicContentRouteDisposition,
    { kind: "published" }
  >["content"],
): Metadata {
  const path = publicContentPath(content.region, content.slug);
  const coverUrl = content.cover
    ? approvedPublicImageUrl(content.cover.path)
    : null;
  const coverAlt = content.cover ? preferredCoverAlt(content.cover) : null;

  return createPublicPageMetadata({
    title: content.title,
    description: content.summary,
    path,
    type: "article",
    image: coverUrl && coverAlt ? { url: coverUrl, alt: coverAlt } : null,
  });
}

function metadataForDisposition(
  region: RegionName,
  slug: string,
  disposition: PublicContentRouteDisposition,
): Metadata {
  if (disposition.kind === "published") {
    return publishedMetadata(disposition.content);
  }
  if (disposition.kind === "archived") {
    return {
      title: disposition.content.title,
      alternates: { canonical: publicContentPath(region, slug) },
      robots: { index: false, follow: true },
    };
  }
  return { robots: { index: false, follow: false } };
}

function sitemapLastModified(item: PublicContentCard): string | undefined {
  for (const candidate of [item.lastTendedAt, item.publishedAt]) {
    if (candidate && !Number.isNaN(Date.parse(candidate))) return candidate;
  }
  return undefined;
}

function isPublishedSitemapCard(item: PublicContentCard): boolean {
  const lifecycle = (item as PublicContentCard & { lifecycle?: unknown })
    .lifecycle;
  return lifecycle === undefined || lifecycle === "Published";
}

export function createPublicRouteIntegration(
  dependencies: PublicRouteIntegrationDependencies,
) {
  async function resolve(
    region: RegionName,
    slug: string,
  ): Promise<PublicContentRouteDisposition> {
    if (!isValidPublicSlug(slug)) return { kind: "not_found" };

    const disposition = await dependencies.readRoute(region, slug);
    return dispositionMatchesRoute(region, slug, disposition)
      ? disposition
      : { kind: "not_found" };
  }

  async function generateStaticParams(
    region: RegionName,
  ): Promise<Array<{ slug: string }>> {
    const items = await dependencies.listPublished({ regions: [region] });
    const seen = new Set<string>();
    const params: Array<{ slug: string }> = [];

    for (const item of items) {
      if (
        item.region !== region ||
        !isValidPublicSlug(item.slug) ||
        seen.has(item.slug)
      ) {
        continue;
      }
      seen.add(item.slug);
      params.push({ slug: item.slug });
    }

    return params;
  }

  async function metadata(region: RegionName, slug: string): Promise<Metadata> {
    try {
      const disposition = await resolve(region, slug);
      return metadataForDisposition(region, slug, disposition);
    } catch {
      return { robots: { index: false, follow: false } };
    }
  }

  async function sitemap(
    siteOrigin: URL = getSiteOrigin(),
  ): Promise<MetadataRoute.Sitemap> {
    const items = await dependencies.listPublished({
      regions: [...PUBLIC_CONTENT_REGIONS],
    });
    const entries = new Map<
      string,
      { url: string; lastModified?: string }
    >();

    for (const item of items) {
      if (
        !isPublishedSitemapCard(item) ||
        !PUBLIC_CONTENT_REGIONS.includes(item.region) ||
        !isValidPublicSlug(item.slug)
      ) {
        continue;
      }

      const path = publicContentPath(item.region, item.slug);
      const lastModified = sitemapLastModified(item);
      entries.set(path, {
        url: absolutePublicUrl(path, siteOrigin),
        ...(lastModified ? { lastModified } : {}),
      });
    }

    return [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([, entry]) => entry);
  }

  return { resolve, generateStaticParams, metadata, sitemap };
}

const defaultIntegration = createPublicRouteIntegration({
  readRoute: getPublicContentRouteDisposition,
  listPublished: getPublishedContent,
});

export const resolvePublicContentRoute = cache(defaultIntegration.resolve);
export const getPublicContentStaticParams = cache(
  defaultIntegration.generateStaticParams,
);
export const getPublicContentMetadata = cache(
  async (region: RegionName, slug: string): Promise<Metadata> => {
    try {
      return metadataForDisposition(
        region,
        slug,
        await resolvePublicContentRoute(region, slug),
      );
    } catch {
      return { robots: { index: false, follow: false } };
    }
  },
);

export const getPublicContentSitemap = defaultIntegration.sitemap;
