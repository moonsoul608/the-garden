import { presentPublicContentCards } from "@/lib/content/public-presentation";
import { getPublishedContent } from "@/lib/content/service";
import { createPublicPageMetadata } from "@/lib/seo";
import { SearchExperience } from "./search-experience";
import "../utilities.css";

export const metadata = createPublicPageMetadata({
  title: "Search the Garden",
  description: "Look for a word. Find a path.",
  path: "/search",
});

export default async function SearchPage() {
  const items = presentPublicContentCards(await getPublishedContent());
  return <main id="main-content" tabIndex={-1} className="discovery-page search-page"><header className="discovery-hero"><p className="eyebrow">A word becomes a path</p><h1>Search the Garden</h1><p className="tagline">Look for a word. Find a path.</p><p>输入一个词，看看它会把你带向哪里。</p></header><SearchExperience items={items} /></main>;
}
