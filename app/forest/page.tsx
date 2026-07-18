import Link from "next/link";
import { presentPublicContentCards } from "@/lib/content/public-presentation";
import { getPublishedContent } from "@/lib/content/service";
import { createPublicPageMetadata } from "@/lib/seo";
import { ForestExperience } from "./forest-experience";
import "./forest.css";

export const metadata = createPublicPageMetadata({
  title: "Forest",
  description: "Where questions grow wild.",
  path: "/forest",
});

export default async function ForestPage() {
  const items = presentPublicContentCards(
    await getPublishedContent({ regions: ["Forest"] }),
  );

  return (
    <main id="main-content" tabIndex={-1} className="forest-page">
      <section className="forest-entrance" aria-labelledby="forest-title">
        <div className="forest-entrance-copy">
          <h1 id="forest-title">Forest</h1>
          <p className="forest-lead">Where questions grow wild.</p>
          <p>这里保存问题、思考、观察，以及暂时还没有答案的想法。</p>
          <div className="forest-entrance-note">
            <p>Not every question needs an answer right away.</p>
            <p>不是每个问题，都需要立刻得到答案。</p>
          </div>
          <Link className="forest-home-link" href="/">← Home</Link>
        </div>
        <div className="forest-landscape" aria-hidden="true">
          <span className="forest-mist" />
          <span className="forest-tree forest-tree-one" />
          <span className="forest-tree forest-tree-two" />
          <span className="forest-tree forest-tree-three" />
          <i className="forest-path" />
        </div>
      </section>

      <ForestExperience items={items} />

      <section className="forest-ending" aria-labelledby="forest-ending-title">
        <div className="forest-ending-mark" aria-hidden="true">⌁</div>
        <h2 id="forest-ending-title">Some paths end in answers. Others become better questions.</h2>
        <p>有些小径通向答案，另一些只会带来更好的问题。</p>
        <nav className="forest-ending-actions" aria-label="Continue from the Forest">
          <Link className="button button-primary" href="/garden">Turn a question into action →</Link>
          <Link className="button button-secondary" href="/greenhouse">Grow a question in the Greenhouse →</Link>
        </nav>
      </section>
    </main>
  );
}
