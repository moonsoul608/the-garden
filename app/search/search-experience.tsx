"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { DiscoveryCard } from "@/components/discovery-card";
import { matchesContentSearch, regionGroupHeadings, regionOrder } from "@/lib/content-discovery";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";

export function SearchExperience({ items }: { items: PublicContentPresentation[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const term = query.trim();
  const results = useMemo(() => term ? items.filter((item) => matchesContentSearch(item, term)) : [], [items, term]);

  return (
    <section className="search-body" aria-labelledby="search-results-title">
      <div className="search-call card">
        <label htmlFor={searchId}>What are you looking for?</label>
        <div className="search-call-field"><span aria-hidden="true">⌕</span><input id={searchId} autoComplete="off" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a word in English or 中文" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear garden search">Clear</button> : null}</div>
        <p>Search titles, summaries, categories, and paths through the garden.</p>
      </div>

      <div className="collection-heading">
        <h2 id="search-results-title">Paths answering the call</h2>
        <p className="result-count" aria-live="polite" aria-atomic="true">{term ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Waiting for a word"}</p>
      </div>

      {!term ? (
        <div className="search-guidance card" role="status"><span aria-hidden="true">⌁</span><h3>Begin with a word.</h3><p>A title, a subject, or a half-remembered path is enough.</p></div>
      ) : results.length ? (
        <div className="search-groups">
          {regionOrder.map((region) => {
            const group = results.filter((item) => item.region === region);
            if (!group.length) return null;
            return <section className="search-group" aria-labelledby={`group-${region}`} key={region}><h3 id={`group-${region}`}>{regionGroupHeadings[region]}</h3><div className="search-result-list">{group.map((item) => <DiscoveryCard item={item} compact key={`${item.region}-${item.id}`} />)}</div></section>;
          })}
        </div>
      ) : (
        <div className="discovery-empty card" role="status">
          <span aria-hidden="true">⌁</span><h3>Nothing answered that call.</h3><p>花园里暂时没有回应这个词的内容。</p><p>Try another word, or wander somewhere unexpected.</p>
          <div className="empty-actions"><button className="button button-secondary" type="button" onClick={() => setQuery("")}>Clear search</button><Link className="button button-primary" href="/?guide=open">Open Garden Guide</Link></div>
        </div>
      )}
    </section>
  );
}
