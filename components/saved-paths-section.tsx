"use client";

import { useEffect, useMemo, useState } from "react";

import { DiscoveryCard } from "@/components/discovery-card";
import {
  removeSavedPath,
  readSavedPaths,
  type SavedPath,
  SAVED_PATHS_CHANGED_EVENT,
} from "@/lib/saved-paths";
import type { PublicContentPresentation } from "@/lib/content/public-presentation";

function contentRoute(item: PublicContentPresentation) {
  return `/${item.region.toLowerCase()}/${item.slug}`;
}

export function SavedPathsSection({
  items,
}: {
  items: PublicContentPresentation[];
}) {
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const syncSavedPaths = () => setSavedPaths(readSavedPaths());
    syncSavedPaths();
    window.addEventListener(SAVED_PATHS_CHANGED_EVENT, syncSavedPaths);
    window.addEventListener("storage", syncSavedPaths);
    return () => {
      window.removeEventListener(SAVED_PATHS_CHANGED_EVENT, syncSavedPaths);
      window.removeEventListener("storage", syncSavedPaths);
    };
  }, []);

  const savedItems = useMemo(() => {
    const itemsByRoute = new Map(items.map((item) => [contentRoute(item), item]));
    return savedPaths.flatMap((savedPath) => {
      const item = itemsByRoute.get(savedPath.route);
      return item ? [item] : [];
    });
  }, [items, savedPaths]);

  function removePath(item: PublicContentPresentation) {
    const removed = removeSavedPath(contentRoute(item));
    setFeedback(
      removed
        ? `Removed ${item.title} from Saved Paths.`
        : "Saved Paths are unavailable in this browser.",
    );
  }

  return (
    <section className="saved-paths-section" aria-labelledby="saved-paths-title">
      <div className="collection-heading">
        <div>
          <p className="eyebrow">Current device</p>
          <h2 id="saved-paths-title">Saved Paths</h2>
        </div>
        <p className="result-count" aria-live="polite" aria-atomic="true">
          {savedItems.length} {savedItems.length === 1 ? "path" : "paths"}
        </p>
      </div>

      {savedItems.length ? (
        <div className="discovery-grid saved-paths-grid">
          {savedItems.map((item) => (
            <div className="saved-path-card" key={`saved-${item.region}-${item.id}`}>
              <DiscoveryCard item={item} compact />
              <button
                type="button"
                className="saved-path-card-toggle"
                aria-pressed="true"
                aria-label={`Remove from Saved Paths: ${item.title}`}
                onClick={() => removePath(item)}
              >
                <span aria-hidden="true">★</span>
                <span>Saved</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="saved-paths-empty card" role="status">
          <span aria-hidden="true">☆</span>
          <h3>No Saved Paths yet.</h3>
          <p>Use the star on a path page to keep it on this device.</p>
        </div>
      )}
      <p className="saved-paths-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}
