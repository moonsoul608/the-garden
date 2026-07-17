import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { V1MigrationPreview } from "../../types/content.ts";
import {
  buildV1MigrationPreview,
  formatV1MigrationPreview,
  serializeV1MigrationPreview,
  type V1ExistingContent,
} from "./preview.ts";

export type V1ApplyReport = V1MigrationPreview;

export type ApplyOptions = {
  preview: boolean;
  execute: boolean;
  production: boolean;
  existingPath: string | null;
  outputPath: string | null;
};

function parseOptions(args: string[]): ApplyOptions {
  const existingArgument = args.find((arg) => arg.startsWith("--existing="));
  const outputArgument = args.find((arg) => arg.startsWith("--output="));
  return {
    preview: args.includes("--preview"),
    execute: args.includes("--execute"),
    production: args.includes("--production"),
    existingPath: existingArgument?.slice("--existing=".length) || null,
    outputPath: outputArgument?.slice("--output=".length) || null,
  };
}

async function readExistingContents(
  path: string | null,
): Promise<V1ExistingContent[]> {
  if (!path) return [];
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!value || typeof value !== "object") {
    throw new Error("Existing snapshot must be a JSON object.");
  }
  const contents = (value as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) {
    throw new Error("Existing snapshot must contain a contents array.");
  }
  return contents.filter(
    (item): item is V1ExistingContent =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

export async function buildV1DryRunReport(
  options: ApplyOptions = {
    preview: false,
    execute: false,
    production: false,
    existingPath: null,
    outputPath: null,
  },
): Promise<V1ApplyReport> {
  const safeguardFailures: V1MigrationPreview["failures"] = [];
  if (options.production) {
    safeguardFailures.push({
      code: "production_forbidden",
      legacyId: null,
      message: "V1 migration preview tooling never targets Production.",
    });
  }
  if (options.execute && !options.preview) {
    safeguardFailures.push({
      code: "preview_flag_required",
      legacyId: null,
      message: "Future execution requires the explicit --preview flag.",
    });
  } else if (options.execute) {
    safeguardFailures.push({
      code: "writes_not_implemented",
      legacyId: null,
      message: "Import execution is intentionally not implemented.",
    });
  }

  let existingContents: V1ExistingContent[] = [];
  try {
    existingContents = await readExistingContents(options.existingPath);
  } catch (error) {
    safeguardFailures.push({
      code: "invalid_existing_snapshot",
      legacyId: null,
      message:
        error instanceof Error
          ? error.message
          : "Existing snapshot could not be read.",
    });
  }

  return buildV1MigrationPreview({
    environment: options.preview ? "preview" : "none",
    existingContents,
    safeguardFailures,
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  const options = parseOptions(process.argv.slice(2));
  const report = await buildV1DryRunReport(options);
  process.stderr.write(formatV1MigrationPreview(report));
  const output = serializeV1MigrationPreview(report);
  if (options.outputPath) {
    await writeFile(options.outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (report.failures.length > 0) process.exitCode = 1;
}
