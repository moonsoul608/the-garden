"use client";

import { useId, useMemo, useState } from "react";
import { DiscoveryCard } from "@/components/discovery-card";
import { matchesContentSearch } from "@/lib/content-discovery";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";
import type { ContentType, RegionName } from "@/types";

const regions: Array<"All Regions" | RegionName> = ["All Regions", "Garden", "Forest", "Lake", "Ruins"];
const contentTypes: Array<"All Types" | ContentType> = ["All Types", "Seed", "Question", "Reflection", "Trace"];

export function IndexExperience({ items }: { items: PublicContentPresentation[] }) {
  const searchId = useId();
  const [region, setRegion] = useState<(typeof regions)[number]>("All Regions");
  const [contentType, setContentType] = useState<(typeof contentTypes)[number]>("All Types");
  const [query, setQuery] = useState("");

  const results = useMemo(() => items.filter((item) =>
    (region === "All Regions" || item.region === region) &&
    (contentType === "All Types" || item.contentType === contentType) &&
    matchesContentSearch(item, query)
  ), [contentType, items, query, region]);

  function clearAll() {
    setRegion("All Regions");
    setContentType("All Types");
    setQuery("");
  }

  return (
    <section className="discovery-body" aria-labelledby="index-collection-title">
      <div className="index-controls card">
        <div className="filter-set">
          <h2>Region</h2>
          <div className="filter-row" role="group" aria-label="Filter by Region">
            {regions.map((value) => <button key={value} type="button" aria-pressed={region === value} onClick={() => setRegion(value)}><span aria-hidden="true">{region === value ? "✓ " : ""}</span>{value}</button>)}
          </div>
        </div>
        <div className="filter-set">
          <h2>Content Type</h2>
          <div className="filter-row" role="group" aria-label="Filter by Content Type">
            {contentTypes.map((value) => <button key={value} type="button" aria-pressed={contentType === value} onClick={() => setContentType(value)}><span aria-hidden="true">{contentType === value ? "✓ " : ""}</span>{value}</button>)}
          </div>
        </div>
        <div className="discovery-search-field">
          <label htmlFor={searchId}>Search the index</label>
          <div className="input-with-action">
            <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a title, idea, or path" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear index search">Clear</button> : null}
          </div>
        </div>
        <button className="button button-secondary clear-filters" type="button" onClick={clearAll} disabled={region === "All Regions" && contentType === "All Types" && !query}>Clear all filters</button>
      </div>

      <div className="collection-heading">
        <h2 id="index-collection-title">Paths kept here</h2>
        <p className="result-count" aria-live="polite" aria-atomic="true">{results.length} {results.length === 1 ? "path" : "paths"}</p>
      </div>

      {results.length ? (
        <div className="discovery-grid">{results.map((item) => <DiscoveryCard item={item} key={`${item.region}-${item.id}`} />)}</div>
      ) : (
        <div className="discovery-empty card" role="status">
          <span aria-hidden="true">⌁</span>
          <h3>Nothing is kept under these paths yet.</h3>
          <p>Try clearing a filter or searching for another word.</p>
          <button className="button button-secondary" type="button" onClick={clearAll}>Clear all</button>
        </div>
      )}
    </section>
  );
}
