import "server-only";

import { redirect } from "next/navigation";

const SAFE_REDIRECT_ORIGIN = "https://garden.invalid";
const DEFAULT_REDIRECT_PATH = "/";

function normalizeRedirectPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const url = new URL(value, SAFE_REDIRECT_ORIGIN);

    if (url.origin !== SAFE_REDIRECT_ORIGIN) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH,
) {
  return (
    normalizeRedirectPath(value) ??
    normalizeRedirectPath(fallback) ??
    DEFAULT_REDIRECT_PATH
  );
}

export function redirectSafely(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH,
): never {
  redirect(getSafeRedirectPath(value, fallback));
}
