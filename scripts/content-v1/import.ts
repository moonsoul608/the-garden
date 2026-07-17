import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  V1ImportDestinationContent,
  V1ImportExecutionPayload,
  V1ImportResult,
  V1MigrationResolutionInput,
} from "../../types/content.ts";
import {
  executeV1Import,
  formatV1ImportResult,
  parseV1ApprovedPreviewSnapshot,
  V1ImportExecutionError,
  type V1ImportExecutionBoundary,
} from "./executor.ts";
import { parseV1MigrationResolutionInput } from "./resolutions.ts";

const DESTINATION_COLUMNS = [
  "id",
  "legacy_id",
  "slug",
  "region",
  "content_type",
  "detail_level",
  "lifecycle",
  "growth_stage",
  "title_zh",
  "title_en",
  "summary_zh",
  "summary_en",
  "body_zh_markdown",
  "body_en_markdown",
  "content_language",
  "primary_categories",
  "cover_image_path",
  "cover_image_alt_zh",
  "cover_image_alt_en",
  "featured",
  "manual_order",
  "published_at",
  "archived_at",
  "last_tended_at",
].join(",");

type ImportCliOptions = {
  execute: boolean;
  preview: boolean;
  production: boolean;
  approvalPath: string | null;
  digest: string | null;
  resolutionsPath: string | null;
  outputPath: string | null;
};

function optionValue(args: string[], name: string): string | null {
  return args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || null;
}

function parseOptions(args: string[]): ImportCliOptions {
  return {
    execute: args.includes("--execute"),
    preview: args.includes("--preview"),
    production: args.includes("--production"),
    approvalPath: optionValue(args, "approval"),
    digest: optionValue(args, "digest"),
    resolutionsPath: optionValue(args, "resolutions"),
    outputPath: optionValue(args, "output"),
  };
}

function requireExecutionOptions(options: ImportCliOptions): asserts options is
  ImportCliOptions & { approvalPath: string; digest: string; resolutionsPath: string } {
  if (!options.execute || !options.preview) {
    throw new V1ImportExecutionError(
      "execution_flags_required",
      "Import execution requires both --execute and --preview.",
    );
  }
  if (options.production) {
    throw new V1ImportExecutionError(
      "production_forbidden",
      "Task 06C import execution is restricted to the Preview database.",
    );
  }
  if (!options.approvalPath) {
    throw new V1ImportExecutionError(
      "approved_snapshot_missing",
      "Import execution requires --approval=<approved-preview-snapshot.json>.",
    );
  }
  if (!options.digest) {
    throw new V1ImportExecutionError(
      "matching_digest_missing",
      "Import execution requires --digest=<approved-preview-digest>.",
    );
  }
  if (!options.resolutionsPath) {
    throw new V1ImportExecutionError(
      "resolution_input_missing",
      "Import execution requires the same --resolutions input used by the approved preview.",
    );
  }
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new V1ImportExecutionError(
      "database_runtime_unavailable",
      `${name} is required; no database execution was attempted.`,
    );
  }
  return value;
}

function asImportResult(value: unknown): V1ImportResult {
  return value as V1ImportResult;
}

export function createSupabaseImportBoundary(
  client: SupabaseClient,
): V1ImportExecutionBoundary {
  return {
    async findImportResult(importDigest) {
      const { data, error } = await client
        .from("v1_migration_imports")
        .select("result")
        .eq("import_digest", importDigest)
        .maybeSingle();
      if (error) {
        throw new V1ImportExecutionError(
          "import_receipt_read_failed",
          `Could not read the migration receipt: ${error.message}`,
        );
      }
      return data ? asImportResult(data.result) : null;
    },

    async readDestinationContents() {
      const { data, error } = await client
        .from("contents")
        .select(DESTINATION_COLUMNS)
        .order("id", { ascending: true });
      if (error) {
        throw new V1ImportExecutionError(
          "destination_snapshot_failed",
          `Could not read the destination snapshot: ${error.message}`,
        );
      }
      return (data ?? []) as unknown as V1ImportDestinationContent[];
    },

    async executeAtomicImport(payload: V1ImportExecutionPayload) {
      const { data, error } = await client.rpc("execute_v1_import", {
        p_payload: payload,
      });
      if (error) {
        throw new V1ImportExecutionError(
          "atomic_import_failed",
          `The database transaction rejected the import: ${error.message}`,
        );
      }
      return asImportResult(data);
    },
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function run(options: ImportCliOptions): Promise<V1ImportResult> {
  requireExecutionOptions(options);
  const approvedSnapshot = parseV1ApprovedPreviewSnapshot(
    await readJson(options.approvalPath),
  );
  const resolutionInput: V1MigrationResolutionInput =
    parseV1MigrationResolutionInput(await readJson(options.resolutionsPath));
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");
  const client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return executeV1Import(
    {
      approvedSnapshot,
      matchingDigest: options.digest,
      resolutionInput,
    },
    createSupabaseImportBoundary(client),
  );
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const result = await run(options);
    process.stderr.write(formatV1ImportResult(result));
    const output = `${JSON.stringify(result, null, 2)}\n`;
    if (options.outputPath) await writeFile(options.outputPath, output, "utf8");
    else process.stdout.write(output);
  } catch (error) {
    const code =
      error instanceof V1ImportExecutionError ? error.code : "import_failed";
    const message = error instanceof Error ? error.message : "Import failed.";
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  }
}
