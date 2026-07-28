"use client";

import { useEffect } from "react";

import { recordRecentlyVisitedPath } from "@/lib/recently-visited";

export function RecentlyVisitedTracker({ route }: { route: string }) {
  useEffect(() => {
    recordRecentlyVisitedPath(route);
  }, [route]);

  return null;
}
