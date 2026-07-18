import { presentPublicContentCards } from "@/lib/content/public-presentation";
import { getPublishedContent } from "@/lib/content/service";
import { createPublicPageMetadata } from "@/lib/seo";
import { IndexExperience } from "../index/index-experience";
import "../../utilities.css";

export const metadata = createPublicPageMetadata({
  title: "Garden Index",
  description: "Everything kept across the garden.",
  path: "/garden-index",
});

export default async function IndexPage() {
  const items = presentPublicContentCards(await getPublishedContent());
  return <main id="main-content" tabIndex={-1} className="discovery-page"><header className="discovery-hero"><p className="eyebrow">A catalogue of paths</p><h1>Garden Index</h1><p className="tagline">Everything kept across the garden.</p><p>查看整座花园中保存的内容。</p></header><IndexExperience items={items} /></main>;
}
