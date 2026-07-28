"use client";

import { useEffect, useMemo, useState } from "react";

import { DiscoveryCard } from "@/components/discovery-card";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";
import {
  readRecentlyVisitedPaths,
  RECENTLY_VISITED_CHANGED_EVENT,
  type RecentlyVisitedPath,
} from "@/lib/recently-visited";

function contentRoute(item: PublicContentPresentation) {
  return `/${item.region.toLowerCase()}/${item.slug}`;
}

function visitedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function RecentlyVisitedSection({
  items,
}: {
  items: PublicContentPresentation[];
}) {
  const [recentPaths, setRecentPaths] = useState<RecentlyVisitedPath[]>([]);

  useEffect(() => {
    const syncRecentPaths = () =>
      setRecentPaths(readRecentlyVisitedPaths());
    syncRecentPaths();
    window.addEventListener(RECENTLY_VISITED_CHANGED_EVENT, syncRecentPaths);
    window.addEventListener("storage", syncRecentPaths);
    return () => {
      window.removeEventListener(
        RECENTLY_VISITED_CHANGED_EVENT,
        syncRecentPaths,
      );
      window.removeEventListener("storage", syncRecentPaths);
    };
  }, []);

  const recentItems = useMemo(() => {
    const itemsByRoute = new Map(items.map((item) => [contentRoute(item), item]));
    return recentPaths.flatMap((recentPath) => {
      const item = itemsByRoute.get(recentPath.route);
      return item ? [{ item, visitedAt: recentPath.visitedAt }] : [];
    });
  }, [items, recentPaths]);

  return (
    <section
      className="saved-paths-section recently-visited-section"
      aria-labelledby="recently-visited-title"
    >
      <div className="collection-heading">
        <div>
          <p className="eyebrow">Current device</p>
          <h2 id="recently-visited-title">Recently Visited</h2>
        </div>
        <p className="result-count" aria-live="polite" aria-atomic="true">
          {recentItems.length} {recentItems.length === 1 ? "path" : "paths"}
        </p>
      </div>

      {recentItems.length ? (
        <div className="discovery-grid saved-paths-grid">
          {recentItems.map(({ item, visitedAt }) => (
            <div
              className="saved-path-card"
              key={`recent-${item.region}-${item.id}`}
            >
              <DiscoveryCard item={item} compact />
              <p className="recently-visited-stamp">
                Visited {visitedLabel(visitedAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="saved-paths-empty card" role="status">
          <span aria-hidden="true">⌕</span>
          <h3>No Recently Visited paths yet.</h3>
          <p>Open a path page and it will appear here on this device.</p>
        </div>
      )}
    </section>
  );
}
