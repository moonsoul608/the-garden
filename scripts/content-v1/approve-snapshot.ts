import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  V1MigrationPreview,
  V1MigrationResolutionInput,
} from "../../types/content.ts";

import {
  buildV1ApprovedMigrationSnapshot,
  formatV1ApprovedMigrationSnapshot,
  serializeV1ApprovedMigrationSnapshot,
} from "./approved-snapshot.ts";
import type { V1ExistingContent } from "./preview.ts";
import { parseV1MigrationResolutionInput } from "./resolutions.ts";

type ApprovalCliOptions = {
  previewPath: string;
  resolutionsPath: string;
  existingPath: string | null;
  createdAt: string;
  outputPath: string | null;
};

function optionValue(args: string[], name: string): string | null {
  return args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || null;
}

function parseOptions(args: string[]): ApprovalCliOptions {
  const previewPath = optionValue(args, "preview");
  const resolutionsPath = optionValue(args, "resolutions");
  const createdAt = optionValue(args, "created-at");
  if (!previewPath || !resolutionsPath || !createdAt) {
    throw new Error(
      "Snapshot approval requires --preview, --resolutions, and an explicit --created-at ISO timestamp.",
    );
  }
  return {
    previewPath,
    resolutionsPath,
    existingPath: optionValue(args, "existing"),
    createdAt,
    outputPath: optionValue(args, "output"),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function readExistingContents(
  path: string | null,
): Promise<V1ExistingContent[]> {
  if (!path) return [];
  const value = await readJson(path);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Existing snapshot must be a JSON object.");
  }
  const contents = (value as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) {
    throw new Error("Existing snapshot must contain a contents array.");
  }
  return contents.filter(
    (record): record is V1ExistingContent =>
      Boolean(record && typeof record === "object" && !Array.isArray(record)),
  );
}

export async function buildV1ApprovedMigrationSnapshotFromFiles(
  options: ApprovalCliOptions,
) {
  const preview = (await readJson(options.previewPath)) as V1MigrationPreview;
  const resolutionInput: V1MigrationResolutionInput =
    parseV1MigrationResolutionInput(await readJson(options.resolutionsPath));
  return buildV1ApprovedMigrationSnapshot({
    preview,
    resolutionInput,
    existingContents: await readExistingContents(options.existingPath),
    createdAt: options.createdAt,
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const snapshot = await buildV1ApprovedMigrationSnapshotFromFiles(options);
    process.stderr.write(formatV1ApprovedMigrationSnapshot(snapshot));
    const output = serializeV1ApprovedMigrationSnapshot(snapshot);
    if (options.outputPath) await writeFile(options.outputPath, output, "utf8");
    else process.stdout.write(output);
    if (snapshot.approvalStatus !== "Approved") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Snapshot approval failed."}\n`,
    );
    process.exitCode = 1;
  }
}
