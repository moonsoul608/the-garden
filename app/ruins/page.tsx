import Link from "next/link";
import { StatusBadge } from "@/components";
import { ruinsItems } from "@/content/ruins";
import { createPublicPageMetadata } from "@/lib/seo";
import "./ruins.css";

export const metadata = createPublicPageMetadata({
  title: "Ruins",
  description: "Ruins are not failures. They are traces.",
  path: "/ruins",
});

const traceTypes = [
  {
    name: "Drafts",
    icon: "📝",
    tagline: "Things that never reached a final version.",
    description: "没有完成、没有定稿，或被后来版本取代的文字与设计。",
  },
  {
    name: "Attempts",
    icon: "🧩",
    tagline: "Things I tried before choosing another path.",
    description: "曾经认真尝试，但后来决定换一条路的内容。",
  },
  {
    name: "Mistakes",
    icon: "⚠️",
    tagline: "Things that taught me by going wrong.",
    description: "因为做错、理解偏差或判断失误而留下的记录。",
  },
] as const;

export default function RuinsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="ruins-page">
      <section className="ruins-entrance" aria-labelledby="ruins-title">
        <div className="ruins-entrance-copy">
          <p className="eyebrow">A place for what remains</p>
          <h1 id="ruins-title">Ruins</h1>
          <p className="ruins-lead">Ruins are not failures. They are traces.</p>
          <p>这里保存废稿、错误、半成品，以及那些没有继续生长、却仍然留下痕迹的尝试。</p>
          <div className="ruins-entrance-note">
            <p>Not everything needs to be restored. Some things only need to be remembered.</p>
            <p>不是所有东西都需要被修复，有些只需要被记住。</p>
          </div>
          <Link className="ruins-home-link" href="/">← Home</Link>
        </div>
        <div className="ruins-still-life" aria-hidden="true">
          <span className="ruins-stone ruins-stone-back" />
          <span className="ruins-paper" />
          <span className="ruins-stone ruins-stone-front" />
          <span className="ruins-sprout"><i /><b /></span>
        </div>
      </section>

      <section className="ruins-section" aria-labelledby="trace-types-title">
        <header className="ruins-heading">
          <p className="eyebrow">Three kinds of remains</p>
          <h2 id="trace-types-title">Types of traces</h2>
          <p className="ruins-section-lead">Different endings leave different marks.</p>
          <p className="ruins-description">不同的结束，会留下不同的痕迹。</p>
        </header>
        <div className="trace-type-grid">
          {traceTypes.map((trace, index) => (
            <article className="trace-type-card card" key={trace.name}>
              <span className="trace-type-number">0{index + 1}</span>
              <span className="trace-type-icon" aria-hidden="true">{trace.icon}</span>
              <h3>{trace.name}</h3>
              <p className="trace-type-tagline">{trace.tagline}</p>
              <p>{trace.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ruins-section ruins-collection" aria-labelledby="remains-title">
        <header className="ruins-heading">
          <p className="eyebrow">A record of changed paths</p>
          <h2 id="remains-title">What remains here</h2>
          <p className="ruins-section-lead">What was left behind can still explain what came next.</p>
          <p className="ruins-description">被留下的东西，仍然能够解释后来发生了什么。</p>
        </header>
        <div className="trace-grid">
          {ruinsItems.map((trace, index) => (
            <article className="trace-card card" key={trace.id}>
              <div className="trace-card-top">
                <span className="trace-index">Trace 0{index + 1}</span>
                {trace.status ? <StatusBadge status={trace.status} /> : null}
              </div>
              <p className="trace-type">{trace.traceType}</p>
              <h3>{trace.title}</h3>
              <p className="trace-summary">{trace.summary}</p>
              <div className="trace-actions">
                <Link
                  className="button button-primary trace-main-link"
                  href={`/ruins/${trace.slug}`}
                  aria-label={`${trace.cta.replace(" →", "")}: ${trace.title}`}
                >
                  {trace.cta}
                </Link>
                {trace.grewInto ? (
                  <Link
                    className="trace-growth-link"
                    href={trace.grewInto}
                    aria-label={`See what grew from ${trace.title}`}
                  >
                    See what grew from it →
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ruins-ending" aria-labelledby="ruins-ending-title">
        <div className="ruins-ending-mark" aria-hidden="true">⌁</div>
        <h2 id="ruins-ending-title">Nothing disappears without leaving something behind.</h2>
        <p>没有什么会彻底消失，它总会留下些什么。</p>
        <nav className="ruins-ending-actions" aria-label="Continue exploring">
          <Link className="button button-primary" href="/garden">Return to what is still growing →</Link>
          <Link className="button button-secondary" href="/forest">Follow a trace into the Forest →</Link>
        </nav>
      </section>
    </main>
  );
}
