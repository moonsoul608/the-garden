import type { Metadata } from "next";
import { Footer, TopBar } from "@/components";
import { FALLBACK_SOCIAL_IMAGE, getSiteOrigin } from "@/lib/seo";
import "./globals.css";

const siteDescription = "A personal digital garden tended by Xianhong.";

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: { default: "The Garden", template: "%s · The Garden" },
  description: siteDescription,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "The Garden",
    title: "The Garden",
    description: siteDescription,
    url: "/",
    images: [{ url: FALLBACK_SOCIAL_IMAGE, alt: "The Garden" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Garden",
    description: siteDescription,
    images: [{ url: FALLBACK_SOCIAL_IMAGE, alt: "The Garden" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><a className="skip-link" href="#main-content">Skip to main content</a><TopBar />{children}<Footer /></body></html>;
}
