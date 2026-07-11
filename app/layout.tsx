import type { Metadata } from "next";
import { Footer, TopBar } from "@/components";
import "./globals.css";

const siteDescription = "A personal digital garden tended by Xianhong.";

export const metadata: Metadata = {
  title: { default: "The Garden", template: "%s · The Garden" },
  description: siteDescription,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "The Garden",
    title: "The Garden",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "The Garden",
    description: siteDescription,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><a className="skip-link" href="#main-content">Skip to main content</a><TopBar />{children}<Footer /></body></html>;
}
