import Link from "next/link";

import {
  detailContent,
  unfinishedMessages,
  type RelatedPath,
} from "@/content/details";
import type {
  PublicArchivedContent,
  PublicContentDetail,
  PublicContentRelation,
} from "@/types";
import {
  createPublicContentStructuredData,
  serializeStructuredData,
} from "@/lib/seo";

import { StatusBadge } from "./status-badge";

const regionHrefs = {
  Garden: "/garden",
  Forest: "/forest",
  Lake: "/lake",
  Ruins: "/ruins",
} as const;

const metadataLabels = {
  Garden: "Bed",
  Forest: "Trail",
  Lake: "Reflection",
  Ruins: "Trace",
} as const;

type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "unordered-list"; items: string[] }
  | { kind: "ordered-list"; items: string[] };

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: Math.max(2, heading[1].length),
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^\d+\.\s+/.test(lines[index].trim())
      ) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "ordered-list", items });
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (
        !next ||
        /^(#{1,4})\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        next.startsWith(">")
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function MarkdownBlocks({ markdown }: { markdown: string }) {
  return parseMarkdown(markdown).map((block, index) => {
    if (block.kind === "heading") {
      return block.level >= 3 ? (
        <h3 key={index}>{block.text}</h3>
      ) : (
        <h2 key={index}>{block.text}</h2>
      );
    }
    if (block.kind === "unordered-list") {
      return (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
    }
    if (block.kind === "ordered-list") {
      return (
        <ol key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ol>
      );
    }
    if (block.kind === "quote") {
      return <blockquote key={index}>{block.text}</blockquote>;
    }
    return <p key={index}>{block.text}</p>;
  });
}

function relationPaths(relations: PublicContentRelation[]): RelatedPath[] {
  const seen = new Set<string>();
  return relations.flatMap(({ target }) => {
    const href = `/${target.region.toLowerCase()}/${target.slug}`;
    if (seen.has(href)) return [];
    seen.add(href);
    return [{ label: target.title, href }];
  });
}

function RelatedPaths({
  paths,
  title = "Related paths",
}: {
  paths: RelatedPath[];
  title?: string;
}) {
  if (paths.length === 0) return null;

  return (
    <section className="detail-related" aria-labelledby="related-paths">
      <p className="eyebrow">Keep wandering</p>
      <h2 id="related-paths">{title}</h2>
      <div className="related-list">
        {paths.map((path) =>
          path.href ? (
            <Link
              className="related-path"
              href={path.href}
              key={`${path.href}-${path.label}`}
            >
              <span>{path.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <div className="related-path related-future" key={path.label}>
              <span>
                <strong>{path.label}</strong>
                <small>Next growth note</small>
              </span>
              <span aria-hidden="true">○</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export function PublicDetailPage({ item }: { item: PublicContentDetail }) {
  const legacyPresentation = detailContent[item.region][item.slug];
  const relatedPaths =
    legacyPresentation?.relatedPaths ?? relationPaths(item.relations);
  const structuredData = serializeStructuredData(
    createPublicContentStructuredData(item),
  );

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`detail-page detail-${item.region.toLowerCase()}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <article className="detail-shell">
        <Link className="detail-back" href={regionHrefs[item.region]}>
          ← Return to the {item.region}
        </Link>
        <header className="detail-header">
          <p className="eyebrow">
            {item.region} · {item.contentType}
          </p>
          <h1>{item.title}</h1>
          <p className="detail-summary">{item.summary}</p>
          <dl className="detail-meta">
            <div>
              <dt>{metadataLabels[item.region]}</dt>
              <dd>{item.primaryCategories.join(" · ")}</dd>
            </div>
            {item.growthStage ? (
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={item.growthStage} />
                </dd>
              </div>
            ) : null}
          </dl>
        </header>

        {item.detailLevel === "short" ? (
          <section className="short-detail" aria-labelledby="unfinished-title">
            <div className="detail-explanation">
              <MarkdownBlocks markdown={item.bodyMarkdown} />
            </div>
            <div className="unfinished-note">
              <span aria-hidden="true">✦</span>
              <div>
                <h2 id="unfinished-title">{unfinishedMessages[item.region]}</h2>
                <p>
                  The path is open, even while the rest is still taking shape.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <div className="detail-body">
            <section>
              <MarkdownBlocks markdown={item.bodyMarkdown} />
            </section>
          </div>
        )}

        <RelatedPaths
          paths={relatedPaths}
          title={legacyPresentation?.relatedTitle}
        />
        <Link
          className="button button-secondary detail-return"
          href={regionHrefs[item.region]}
        >
          Return to the {item.region}
        </Link>
      </article>
    </main>
  );
}

export function ArchivedDetailPage({ item }: { item: PublicArchivedContent }) {
  const paths = item.relations.map(({ target }) => ({
    label: target.title,
    href: `/${target.region.toLowerCase()}/${target.slug}`,
  }));

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`detail-page detail-${item.region.toLowerCase()}`}
    >
      <article className="detail-shell">
        <Link className="detail-back" href={regionHrefs[item.region]}>
          ← Return to the {item.region}
        </Link>
        <header className="detail-header">
          <p className="eyebrow">{item.region} · Archived</p>
          <h1>{item.title}</h1>
          <dl className="detail-meta">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={item.growthStage} />
              </dd>
            </div>
          </dl>
        </header>
        <section className="short-detail" aria-label="Archived path">
          <p className="detail-explanation">
            This path is still being prepared.
          </p>
        </section>
        <RelatedPaths paths={paths} />
        <Link
          className="button button-secondary detail-return"
          href={regionHrefs[item.region]}
        >
          Return to the {item.region}
        </Link>
      </article>
    </main>
  );
}
