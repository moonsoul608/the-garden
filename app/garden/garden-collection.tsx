"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { StatusBadge } from "@/components";
import { gardenItems } from "@/content/garden";
import type { GardenItem } from "@/types";

type GardenCollectionProps = { beds: readonly string[] };

export function GardenCollection({ beds }: GardenCollectionProps) {
  const searchId = useId();
  const [activeBed, setActiveBed] = useState("All");
  const [query, setQuery] = useState("");

  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return gardenItems.filter((item) => {
      const searchableItem: GardenItem = item;
      const inBed = activeBed === "All" || item.beds.includes(activeBed);
      const searchable = [item.title, item.summary, ...item.categories, ...(searchableItem.tags ?? [])].join(" ").toLocaleLowerCase();
      return inBed && (!term || searchable.includes(term));
    });
  }, [activeBed, query]);

  const reset = () => { setActiveBed("All"); setQuery(""); };

  return (
    <section className="garden-section garden-collection" aria-labelledby="collection-title">
      <div className="garden-controls card">
        <div>
          <p className="eyebrow">Filter the beds</p>
          <h2>Choose what is growing</h2>
        </div>
        <div className="bed-filters" role="group" aria-label="Filter Seeds by bed">
          {["All", ...beds].map((bed) => (
            <button key={bed} type="button" className="bed-filter" aria-pressed={activeBed === bed} onClick={() => setActiveBed(bed)}><span aria-hidden="true">{activeBed === bed ? "✓ " : ""}</span>{bed}</button>
          ))}
        </div>
        <div className="garden-search">
          <label htmlFor={searchId}>Search the Garden</label>
          <div className="garden-search-field">
            <span aria-hidden="true">⌕</span>
            <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Garden" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear Garden search">Clear</button> : null}
          </div>
        </div>
      </div>

      <header className="garden-heading collection-heading">
        <div>
          <p className="eyebrow">Seed collection</p>
          <h2 id="collection-title">What is growing here</h2>
          <p className="garden-section-lead">A collection of ideas still taking shape.</p>
          <p className="garden-description">这里收集着正在学习、练习和逐渐成形的内容。</p>
        </div>
        <p className="result-count" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? "Seed" : "Seeds"}</p>
      </header>

      {visibleItems.length > 0 ? (
        <div className="seed-grid">
          {visibleItems.map((item, index) => (
            <article className="seed-card card" key={item.id}>
              <div className="seed-card-top"><span className="seed-index">Seed {String(index + 1).padStart(2, "0")}</span>{item.status && <StatusBadge status={item.status} />}</div>
              <h3>{item.title}</h3>
              <p className="seed-summary">{item.summary}</p>
              <ul className="seed-beds" aria-label="Growing beds">{item.beds.map((bed) => <li key={bed}>{bed}</li>)}</ul>
              <Link className="seed-link" href={`/garden/${item.slug}`}>{item.cta}</Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="garden-empty card" role="status">
          <span aria-hidden="true">·</span>
          <h3>Nothing is growing here yet.</h3>
          <p>Maybe this bed is waiting for its first seed.</p>
          <button className="button button-secondary" type="button" onClick={reset}>Show all Seeds</button>
        </div>
      )}
    </section>
  );
}
