"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { forestItems } from "@/content/forest";
import { gardenItems } from "@/content/garden";
import { lakeItems } from "@/content/lake";
import { ruinsItems } from "@/content/ruins";
import { regions } from "@/lib/regions";

const allContent = [...gardenItems, ...forestItems, ...lakeItems, ...ruinsItems];

const compassCandidates = [
  ...regions.filter((region) => region.name !== "Home").map((region) => ({
    title: region.name,
    description: region.tagline,
    href: region.href,
    kind: "Region",
  })),
  ...allContent.map((item) => ({
    title: item.title,
    description: item.summary,
    href: `/${item.region.toLowerCase()}/${item.slug}`,
    kind: item.contentType,
  })),
] as const;

export function Opening() {
  return (
    <section className="opening" aria-label="Opening">
      <a className="opening-skip" href="#welcome">Skip opening</a>
      <div className="opening-words">
        <p>Take your time.</p>
        <p>There is no right path.</p>
      </div>
      <a className="button button-primary opening-button" href="#welcome">Plant the seed.</a>
    </section>
  );
}

export function RandomCompass() {
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const previousIndex = useRef<number | null>(null);

  function chooseDirection() {
    let nextIndex = Math.floor(Math.random() * compassCandidates.length);
    if (compassCandidates.length > 1 && nextIndex === previousIndex.current) {
      nextIndex = (nextIndex + 1) % compassCandidates.length;
    }
    previousIndex.current = nextIndex;
    setResultIndex(nextIndex);
  }

  const result = resultIndex === null ? null : compassCandidates[resultIndex];

  return (
    <div className="compass card">
      <div className={`compass-rose${result ? " compass-rose-chosen" : ""}`} aria-hidden="true"><span>N</span><i /></div>
      <div className="compass-content" aria-live="polite" aria-atomic="true">
        {result ? (
          <div className="compass-result">
            <p className="card-meta">{result.kind}</p>
            <h3>{result.title}</h3>
            <p>{result.description}</p>
            <div className="compass-actions">
              <Link className="button button-primary" href={result.href}>Follow the compass</Link>
              <button className="button button-secondary" type="button" onClick={chooseDirection}>Try another direction</button>
            </div>
          </div>
        ) : (
          <button className="button button-primary" type="button" onClick={chooseDirection}>Follow the compass</button>
        )}
      </div>
    </div>
  );
}

export function HiddenSeed() {
  const [found, setFound] = useState(false);
  return (
    <div className="hidden-seed">
      <button type="button" className="seed-button" onClick={() => setFound(true)} aria-expanded={found} aria-controls="hidden-seed-copy">
        <span aria-hidden="true">✦</span><span className="sr-only">Find the hidden Seed</span>
      </button>
      {found && <div id="hidden-seed-copy" className="seed-message" role="status"><p>You found something that was not on the map.</p><p>你发现了地图上没有标出的东西。</p></div>}
    </div>
  );
}
