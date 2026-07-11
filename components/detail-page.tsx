import Link from "next/link";
import { detailContent, unfinishedMessages, type DetailBlock, type RelatedPath } from "@/content/details";
import { StatusBadge } from "@/components/status-badge";
import type { ContentItem, ForestItem, GardenItem, LakeItem, RuinsItem } from "@/types";

const regionHrefs = { Garden: "/garden", Forest: "/forest", Lake: "/lake", Ruins: "/ruins" } as const;

function itemMetadata(item: ContentItem) {
  if (item.region === "Garden") return [{ label: "Bed", value: (item as GardenItem).beds.join(" · ") }];
  if (item.region === "Forest") return [{ label: "Trail", value: (item as ForestItem).trails.join(" · ") }];
  if (item.region === "Lake") return [{ label: "Reflection", value: (item as LakeItem).reflectionType }];
  return [{ label: "Trace", value: (item as RuinsItem).traceType }];
}

function ContentBlock({ block }: { block: DetailBlock }) {
  if (block.type === "paragraph") return <p>{block.text}</p>;
  if (block.type === "list") return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  return <div className="detail-notes">{block.items.map((note) => <article key={note.title}><h3>{note.title}</h3><p>{note.text}</p></article>)}</div>;
}

function RelatedPaths({ paths, title = "Related paths" }: { paths: RelatedPath[]; title?: string }) {
  return <section className="detail-related" aria-labelledby="related-paths"><p className="eyebrow">Keep wandering</p><h2 id="related-paths">{title}</h2><div className="related-list">{paths.map((path) => path.href ? <Link className="related-path" href={path.href} key={path.label}><span>{path.label}</span><span aria-hidden="true">→</span></Link> : <div className="related-path related-future" key={path.label}><span><strong>{path.label}</strong><small>Next growth note</small></span><span aria-hidden="true">○</span></div>)}</div></section>;
}

export function DetailPage({ item }: { item: ContentItem }) {
  const content = detailContent[item.region][item.slug];
  const isShort = item.detailLevel === "short";

  return <main id="main-content" tabIndex={-1} className={`detail-page detail-${item.region.toLowerCase()}`}>
    <article className="detail-shell">
      <Link className="detail-back" href={regionHrefs[item.region]}>← Return to the {item.region}</Link>
      <header className="detail-header">
        <p className="eyebrow">{item.region} · {item.contentType}</p>
        <h1>{item.title}</h1>
        <p className="detail-summary">{item.summary}</p>
        <dl className="detail-meta">
          {itemMetadata(item).map((meta) => <div key={meta.label}><dt>{meta.label}</dt><dd>{meta.value}</dd></div>)}
          {item.status ? <div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div> : null}
        </dl>
      </header>

      {isShort ? <section className="short-detail" aria-labelledby="unfinished-title">
        <p className="detail-explanation">{content.explanation}</p>
        <div className="unfinished-note"><span aria-hidden="true">✦</span><div><h2 id="unfinished-title">{unfinishedMessages[item.region]}</h2><p>The path is open, even while the rest is still taking shape.</p></div></div>
      </section> : <div className="detail-body">{content.sections?.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.blocks.map((block, index) => <ContentBlock block={block} key={`${section.title}-${index}`} />)}</section>)}</div>}

      <RelatedPaths paths={content.relatedPaths} title={content.relatedTitle} />
      <Link className="button button-secondary detail-return" href={regionHrefs[item.region]}>Return to the {item.region}</Link>
    </article>
  </main>;
}
