"use client";

import { useEffect, useState } from "react";

import {
  isPathSaved,
  removeSavedPath,
  savePath,
  SAVED_PATHS_CHANGED_EVENT,
} from "@/lib/saved-paths";

type SavedPathToggleProps = {
  route: string;
  title: string;
};

export function SavedPathToggle({ route, title }: SavedPathToggleProps) {
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const syncSavedState = () => setSaved(isPathSaved(route));
    syncSavedState();
    window.addEventListener(SAVED_PATHS_CHANGED_EVENT, syncSavedState);
    window.addEventListener("storage", syncSavedState);
    return () => {
      window.removeEventListener(SAVED_PATHS_CHANGED_EVENT, syncSavedState);
      window.removeEventListener("storage", syncSavedState);
    };
  }, [route]);

  function toggleSaved() {
    if (saved) {
      const removed = removeSavedPath(route);
      if (!removed) {
        setFeedback("Saved Paths are unavailable in this browser.");
        return;
      }
      setSaved(false);
      setFeedback("Removed from Saved Paths.");
    } else {
      const stored = savePath(route);
      if (!stored) {
        setFeedback("Saved Paths are unavailable in this browser.");
        return;
      }
      setSaved(true);
      setFeedback("Saved to this device.");
    }
  }

  return (
    <div className="saved-path-control">
      <button
        type="button"
        className="saved-path-toggle"
        aria-pressed={saved}
        aria-label={`${saved ? "Remove from" : "Save to"} Saved Paths: ${title}`}
        onClick={toggleSaved}
      >
        <span aria-hidden="true">{saved ? "★" : "☆"}</span>
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
      <p className="saved-path-disclosure">Saved Paths stay on this device.</p>
      <p className="saved-path-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
