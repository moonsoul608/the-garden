import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  V1ImportResult,
  V1MigrationPreview,
} from "../../types/content.ts";
import {
  formatV1MigrationVerificationReport,
  serializeV1MigrationVerificationReport,
  verifyV1Migration,
  type V1MigrationVerificationQueryResults,
} from "./migration-verification.ts";

type Options = {
  reportPath: string | null;
  previewPath: string | null;
  queriesPath: string | null;
  outputPath: string | null;
};

function optionValue(args: string[], name: string): string | null {
  return args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || null;
}

function parseOptions(args: string[]): Options {
  return {
    reportPath: optionValue(args, "report"),
    previewPath: optionValue(args, "preview"),
    queriesPath: optionValue(args, "queries"),
    outputPath: optionValue(args, "output"),
  };
}

function requirePath(value: string | null, option: string): string {
  if (!value) throw new Error(`Migration verification requires --${option}=<path>.`);
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function assertKind(value: unknown, kind: string, label: string): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as { kind?: unknown }).kind !== kind
  ) {
    throw new Error(`${label} must be a ${kind} JSON document.`);
  }
}

async function run(options: Options) {
  const [executionReport, expectedPreview, queryResults] = await Promise.all([
    readJson(requirePath(options.reportPath, "report")),
    readJson(requirePath(options.previewPath, "preview")),
    readJson(requirePath(options.queriesPath, "queries")),
  ]);
  assertKind(executionReport, "v1-import-result", "Execution report");
  assertKind(expectedPreview, "v1-import-preview", "Expected preview");
  assertKind(
    queryResults,
    "v1-migration-verification-query-results",
    "V2 query results",
  );

  return verifyV1Migration({
    executionReport: executionReport as V1ImportResult,
    expectedPreview: expectedPreview as V1MigrationPreview,
    queryResults: queryResults as V1MigrationVerificationQueryResults,
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const report = await run(options);
    process.stderr.write(formatV1MigrationVerificationReport(report));
    const output = serializeV1MigrationVerificationReport(report);
    if (options.outputPath) await writeFile(options.outputPath, output, "utf8");
    else process.stdout.write(output);
    if (report.status === "FAIL") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Migration verification failed."}\n`,
    );
    process.exitCode = 1;
  }
}
