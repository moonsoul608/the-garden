import "server-only";

import type { Metadata } from "next";

import type { PublicContentDetail, RegionName } from "@/types";

export const PUBLIC_CONTENT_REGIONS = [
  "Garden",
  "Forest",
  "Lake",
  "Ruins",
] as const satisfies readonly RegionName[];

export const FALLBACK_SOCIAL_IMAGE = "/opengraph-image.png";

const DEFAULT_SITE_ORIGIN = "http://localhost:3000";
const INTERNAL_UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function configuredSiteOrigin(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured;

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  return vercelHost ? `https://${vercelHost}` : DEFAULT_SITE_ORIGIN;
}

export function getSiteOrigin(value = configuredSiteOrigin()): URL {
  const origin = new URL(value);
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new TypeError("SITE_URL must use http or https.");
  }

  return new URL(origin.origin);
}

export function publicContentPath(region: RegionName, slug: string): string {
  return `/${region.toLowerCase()}/${slug}`;
}

export function absolutePublicUrl(
  path: string,
  siteOrigin: URL = getSiteOrigin(),
): string {
  return new URL(path, siteOrigin).toString();
}

export function approvedPublicImageUrl(path: string): string | null {
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

type PublicPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: { url: string; alt: string } | null;
  type?: "article" | "website";
};

export function createPublicPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: PublicPageMetadataInput): Metadata {
  const socialImage = image ?? {
    url: FALLBACK_SOCIAL_IMAGE,
    alt: "The Garden",
  };

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type,
      siteName: "The Garden",
      title,
      description,
      url: path,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

function structuredLanguage(
  language: PublicContentDetail["contentLanguage"],
): string | string[] | undefined {
  if (language === "zh") return "zh-CN";
  if (language === "en") return "en";
  if (language === "bilingual") return ["zh-CN", "en"];
  return undefined;
}

function validDate(value: string | null): string | undefined {
  return value && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export function createPublicContentStructuredData(
  content: PublicContentDetail,
  siteOrigin: URL = getSiteOrigin(),
): Record<string, unknown> {
  const path = publicContentPath(content.region, content.slug);
  const language = structuredLanguage(content.contentLanguage);
  const coverUrl = content.cover
    ? approvedPublicImageUrl(content.cover.path)
    : null;
  const datePublished = validDate(content.publishedAt);
  const dateModified = validDate(content.lastTendedAt);

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: content.title,
    description: content.summary,
    url: absolutePublicUrl(path, siteOrigin),
    genre: content.contentType,
    ...(language ? { inLanguage: language } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(coverUrl
      ? { image: absolutePublicUrl(coverUrl, siteOrigin) }
      : {}),
  };
}

export function serializeStructuredData(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
