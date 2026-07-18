"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";

const ripples = ["All", "Music", "Games", "Films", "Books & Words", "Internet"] as const;

export function LakeExperience({ items }: { items: PublicContentPresentation[] }) {
  const [activeRipple, setActiveRipple] = useState<(typeof ripples)[number]>("All");
  const [surfacedIndex, setSurfacedIndex] = useState<number | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => activeRipple === "All" || item.primaryCategories.includes(activeRipple)),
    [activeRipple, items],
  );
  const surfaced = surfacedIndex === null ? null : items[surfacedIndex];

  function surfaceReflection() {
    setSurfacedIndex((current) => {
      if (items.length < 2) return 0;
      let next = Math.floor(Math.random() * items.length);
      if (next === current) next = (next + 1) % items.length;
      return next;
    });
  }

  return (
    <>
      <section className="lake-section ripples-section" aria-labelledby="ripples-title">
        <header className="lake-heading">
          <p className="eyebrow">Choose a current</p>
          <h2 id="ripples-title">Ripples</h2>
          <p className="lake-section-lead">Different things leave different kinds of echoes.</p>
          <p className="lake-description">不同的事物，会留下不同的回声。</p>
        </header>
        <div className="ripple-filters" role="group" aria-label="Filter Reflections by ripple">
          {ripples.map((ripple) => (
            <button key={ripple} className="ripple-filter" type="button" aria-pressed={activeRipple === ripple} onClick={() => setActiveRipple(ripple)}>
              <span aria-hidden="true">{activeRipple === ripple ? "◉" : "○"}</span>{ripple}
            </button>
          ))}
        </div>
      </section>

      <section className="lake-section reflection-collection" aria-labelledby="reflections-title">
        <header className="lake-heading collection-heading">
          <div>
            <p className="eyebrow">Reflection collection</p>
            <h2 id="reflections-title">Reflections on the water</h2>
            <p className="lake-section-lead">Things that stayed after the moment passed.</p>
            <p className="lake-description">时刻过去以后，仍然留下来的东西。</p>
          </div>
          <p className="reflection-count" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? "Reflection" : "Reflections"}</p>
        </header>
        <div className="reflection-grid">
          {visibleItems.map((item, index) => (
            <Link className="reflection-card card" href={`/lake/${item.slug}`} key={item.id}>
              <div className="reflection-card-top"><span>Reflection {String(index + 1).padStart(2, "0")}</span><span>{item.primaryCategories[0]}</span></div>
              <div className="reflection-ring" aria-hidden="true"><span /></div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <span className="reflection-cta">{item.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surfaced-section" aria-labelledby="surfaced-title">
        <div className="surfaced-inner">
          <header className="lake-heading">
            <p className="eyebrow">From deeper water</p>
            <h2 id="surfaced-title">Something surfaced</h2>
            <p className="lake-section-lead">The lake brought something back.</p>
            <p className="lake-description">湖面带回了一样东西。</p>
          </header>
          <div className="surfaced-result" aria-live="polite">
            {surfaced ? (
              <article className="surfaced-card card">
                <span className="surfaced-type">{surfaced.primaryCategories[0]} · Reflection</span>
                <h3>{surfaced.title}</h3>
                <p>{surfaced.summary}</p>
                <div className="surfaced-actions">
                  <Link className="button button-primary" href={`/lake/${surfaced.slug}`}>Look closer</Link>
                  <button className="button button-secondary" type="button" onClick={surfaceReflection}>Let something else surface</button>
                </div>
              </article>
            ) : (
              <button className="button button-primary surface-button" type="button" onClick={surfaceReflection}>See what surfaces</button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
