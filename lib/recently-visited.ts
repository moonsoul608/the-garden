export type RecentlyVisitedPath = {
  route: string;
  visitedAt: string;
};

export const RECENTLY_VISITED_STORAGE_KEY =
  "the-garden:recently-visited:v2";
export const RECENTLY_VISITED_CHANGED_EVENT =
  "the-garden:recently-visited-changed";
export const RECENTLY_VISITED_LIMIT = 12;

function isRecentlyVisitedPath(
  value: unknown,
): value is RecentlyVisitedPath {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecentlyVisitedPath>;
  return (
    typeof candidate.route === "string" &&
    candidate.route.startsWith("/") &&
    typeof candidate.visitedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.visitedAt))
  );
}

function newestFirst(
  left: RecentlyVisitedPath,
  right: RecentlyVisitedPath,
) {
  return Date.parse(right.visitedAt) - Date.parse(left.visitedAt);
}

export function readRecentlyVisitedPaths(): RecentlyVisitedPath[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENTLY_VISITED_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const routes = new Set<string>();
    return parsed
      .filter(isRecentlyVisitedPath)
      .sort(newestFirst)
      .filter((path) => {
        if (routes.has(path.route)) return false;
        routes.add(path.route);
        return true;
      })
      .slice(0, RECENTLY_VISITED_LIMIT);
  } catch {
    return [];
  }
}

function writeRecentlyVisitedPaths(paths: RecentlyVisitedPath[]) {
  try {
    window.localStorage.setItem(
      RECENTLY_VISITED_STORAGE_KEY,
      JSON.stringify(paths.slice(0, RECENTLY_VISITED_LIMIT)),
    );
    window.dispatchEvent(new Event(RECENTLY_VISITED_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function recordRecentlyVisitedPath(route: string) {
  if (!route.startsWith("/")) return false;

  const existing = readRecentlyVisitedPaths().filter(
    (path) => path.route !== route,
  );
  return writeRecentlyVisitedPaths([
    { route, visitedAt: new Date().toISOString() },
    ...existing,
  ]);
}
