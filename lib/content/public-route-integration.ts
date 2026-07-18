import "server-only";

import type { Metadata } from "next";
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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

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

function approvedPublicCoverUrl(path: string): string | null {
  const candidate = path.trim();
  if (!candidate || INTERNAL_UUID_PATTERN.test(candidate)) return null;
  if (/^\/(?!\/)/.test(candidate)) return candidate;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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
  const metadata: Metadata = {
    title: content.title,
    description: content.summary,
  };
  const coverUrl = content.cover
    ? approvedPublicCoverUrl(content.cover.path)
    : null;
  const coverAlt = content.cover ? preferredCoverAlt(content.cover) : null;

  if (coverUrl && coverAlt) {
    metadata.openGraph = {
      title: content.title,
      description: content.summary,
      images: [{ url: coverUrl, alt: coverAlt }],
    };
    metadata.twitter = {
      card: "summary_large_image",
      title: content.title,
      description: content.summary,
      images: [{ url: coverUrl, alt: coverAlt }],
    };
  }

  return metadata;
}

function metadataForDisposition(
  disposition: PublicContentRouteDisposition,
): Metadata {
  if (disposition.kind === "published") {
    return publishedMetadata(disposition.content);
  }
  if (disposition.kind === "archived") {
    return {
      title: disposition.content.title,
      robots: { index: false, follow: true },
    };
  }
  return {};
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
      return metadataForDisposition(disposition);
    } catch {
      return { robots: { index: false, follow: false } };
    }
  }

  return { resolve, generateStaticParams, metadata };
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
        await resolvePublicContentRoute(region, slug),
      );
    } catch {
      return { robots: { index: false, follow: false } };
    }
  },
);
