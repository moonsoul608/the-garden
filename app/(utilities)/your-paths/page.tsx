import { RecentlyVisitedSection } from "@/components/recently-visited-section";
import { SavedPathsSection } from "@/components/saved-paths-section";
import { presentPublicContentCards } from "@/lib/content/public-presentation";
import { getPublishedContent } from "@/lib/content/service";
import { createPublicPageMetadata } from "@/lib/seo";

import "../../utilities.css";

export const metadata = createPublicPageMetadata({
  title: "Your Paths",
  description: "Saved paths kept locally on this device.",
  path: "/your-paths",
});

export default async function YourPathsPage() {
  const items = presentPublicContentCards(await getPublishedContent());

  return (
    <main id="main-content" tabIndex={-1} className="discovery-page">
      <header className="discovery-hero">
        <p className="eyebrow">Current device</p>
        <h1>Your Paths</h1>
        <p className="tagline">Saved paths kept locally on this device.</p>
        <p>这里保存你在这台设备上标记过的路径。</p>
      </header>
      <section className="discovery-body" aria-label="Your paths">
        <SavedPathsSection items={items} />
        <RecentlyVisitedSection items={items} />
      </section>
    </main>
  );
}
