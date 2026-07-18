/* eslint-disable @next/next/no-img-element -- Public covers may use editor-approved HTTPS origins that are not known at build time. */
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
  approvedPublicImageUrl,
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

type RelatedPathPresentation = RelatedPath & {
  context?: string;
  note?: string;
  relationship?: string;
};

const relationshipLabels = {
  grewFrom: "Grew from",
  grewInto: "Grew into",
  relatedTo: "Related path",
} as const;

function relationPaths(
  relations: PublicContentRelation[],
): RelatedPathPresentation[] {
  const seen = new Set<string>();
  return relations.flatMap((relation) => {
    const { target } = relation;
    const href = `/${target.region.toLowerCase()}/${target.slug}`;
    if (seen.has(href)) return [];
    seen.add(href);
    return [
      {
        label: target.title,
        href,
        relationship: relationshipLabels[relation.relationType],
        context: `${target.region} · ${target.contentType}`,
        note: relation.noteZh?.trim() || relation.noteEn?.trim() || undefined,
      },
    ];
  });
}

function publicDate(value: string | null): {
  dateTime: string;
  label: string;
} | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    dateTime: date.toISOString(),
    label: new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(date),
  };
}

function preferredCoverAlt(
  cover: PublicContentDetail["cover"],
): string | null {
  if (!cover) return null;
  return cover.altZh?.trim() || cover.altEn?.trim() || null;
}

function RelatedPaths({
  paths,
  title = "Related paths",
}: {
  paths: RelatedPathPresentation[];
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
              <span className="related-path-copy">
                {path.relationship ? (
                  <small className="related-relationship">
                    {path.relationship}
                  </small>
                ) : null}
                <strong>{path.label}</strong>
                {path.context ? (
                  <small className="related-context">{path.context}</small>
                ) : null}
                {path.note ? (
                  <span className="related-note">{path.note}</span>
                ) : null}
              </span>
              <span className="related-arrow" aria-hidden="true">→</span>
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

function GrowthTimeline({
  notes,
}: {
  notes: PublicContentDetail["growthTimeline"];
}) {
  if (notes.length === 0) return null;

  return (
    <section className="detail-timeline" aria-labelledby="growth-timeline-title">
      <p className="eyebrow">Tending notes</p>
      <h2 id="growth-timeline-title">Growth Timeline</h2>
      <ol className="timeline-list">
        {notes.map((note, index) => {
          const occurredAt = publicDate(note.occurredAt);
          const copy = note.noteZh?.trim() || note.noteEn?.trim();

          return (
            <li key={`${note.occurredAt}-${note.toStage}-${index}`}>
              <div className="timeline-marker" aria-hidden="true" />
              <div className="timeline-heading">
                <StatusBadge status={note.toStage} />
                {occurredAt ? (
                  <time dateTime={occurredAt.dateTime}>{occurredAt.label}</time>
                ) : null}
              </div>
              {note.fromStage ? (
                <p className="timeline-transition">From {note.fromStage}</p>
              ) : null}
              {copy ? <p>{copy}</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PublicDetailPage({ item }: { item: PublicContentDetail }) {
  const legacyPresentation = detailContent[item.region][item.slug];
  const relatedPaths =
    item.relations.length > 0
      ? relationPaths(item.relations)
      : (legacyPresentation?.relatedPaths ?? []);
  const structuredData = serializeStructuredData(
    createPublicContentStructuredData(item),
  );
  const coverUrl = item.cover
    ? approvedPublicImageUrl(item.cover.path)
    : null;
  const coverAlt = preferredCoverAlt(item.cover);
  const publishedAt = publicDate(item.publishedAt);
  const lastTendedAt = publicDate(item.lastTendedAt);

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
            {item.primaryCategories.length > 0 ? (
              <div>
                <dt>{metadataLabels[item.region]}</dt>
                <dd>{item.primaryCategories.join(" · ")}</dd>
              </div>
            ) : null}
            {item.growthStage ? (
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={item.growthStage} />
                </dd>
              </div>
            ) : null}
            {publishedAt ? (
              <div>
                <dt>Published</dt>
                <dd><time dateTime={publishedAt.dateTime}>{publishedAt.label}</time></dd>
              </div>
            ) : null}
            {lastTendedAt ? (
              <div>
                <dt>Last tended</dt>
                <dd><time dateTime={lastTendedAt.dateTime}>{lastTendedAt.label}</time></dd>
              </div>
            ) : null}
            {item.tags.length > 0 ? (
              <div className="detail-meta-wide">
                <dt>Tags</dt>
                <dd>
                  <ul className="detail-tags" aria-label="Tags">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </header>

        {coverUrl && coverAlt ? (
          <figure className="detail-cover">
            <img
              src={coverUrl}
              alt={coverAlt}
              width={1600}
              height={900}
              decoding="async"
              fetchPriority="high"
              loading="eager"
            />
          </figure>
        ) : null}

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
            <MarkdownBlocks markdown={item.bodyMarkdown} />
          </div>
        )}

        <GrowthTimeline notes={item.growthTimeline} />
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
    context: `${target.region} · ${target.growthStage}`,
    relationship: "Related path",
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
