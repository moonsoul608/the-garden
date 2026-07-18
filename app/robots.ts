import type { MetadataRoute } from "next";

import { absolutePublicUrl, getSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteOrigin = getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/auth", "/preview"],
    },
    sitemap: absolutePublicUrl("/sitemap.xml", siteOrigin),
    host: siteOrigin.origin,
  };
}
