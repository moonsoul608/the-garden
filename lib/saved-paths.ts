export type SavedPath = {
  route: string;
  savedAt: string;
};

export const SAVED_PATHS_STORAGE_KEY = "the-garden:saved-paths:v2";
export const SAVED_PATHS_CHANGED_EVENT = "the-garden:saved-paths-changed";

function isSavedPath(value: unknown): value is SavedPath {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedPath>;
  return (
    typeof candidate.route === "string" &&
    candidate.route.startsWith("/") &&
    typeof candidate.savedAt === "string"
  );
}

export function readSavedPaths(): SavedPath[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(SAVED_PATHS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedPath);
  } catch {
    return [];
  }
}

function writeSavedPaths(paths: SavedPath[]) {
  try {
    window.localStorage.setItem(SAVED_PATHS_STORAGE_KEY, JSON.stringify(paths));
    window.dispatchEvent(new Event(SAVED_PATHS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function isPathSaved(route: string) {
  return readSavedPaths().some((path) => path.route === route);
}

export function savePath(route: string) {
  const existing = readSavedPaths().filter((path) => path.route !== route);
  return writeSavedPaths([
    { route, savedAt: new Date().toISOString() },
    ...existing,
  ]);
}

export function removeSavedPath(route: string) {
  return writeSavedPaths(readSavedPaths().filter((path) => path.route !== route));
}
