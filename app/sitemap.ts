import type { MetadataRoute } from "next";

import { getPublicContentSitemap } from "@/lib/content/public-route-integration";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getPublicContentSitemap();
}
