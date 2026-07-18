import { createHash } from "node:crypto";

export function canonicalizeV1MigrationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeV1MigrationValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en-US"))
      .map(([key, entry]) => [key, canonicalizeV1MigrationValue(entry)]),
  );
}

export function stableV1MigrationJson(value: unknown): string {
  return JSON.stringify(canonicalizeV1MigrationValue(value));
}

export function digestV1MigrationValue(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(stableV1MigrationJson(value))
    .digest("hex")}`;
}

export const V1_SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
