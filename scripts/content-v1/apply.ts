import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  V1MigrationCompatibilityWarning,
  V1MigrationContentRecord,
  V1MigrationIssue,
} from "../../types/content.ts";

import { transformV1Content } from "./transform.ts";
import {
  verifyV1MigrationBundle,
  type V1VerificationFailure,
} from "./verify.ts";

type ExistingContent = Record<string, unknown>;

export type V1ApplyReport = {
  schemaVersion: 1;
  mode: "dry-run";
  environment: "none" | "preview";
  idempotencyKey: "contents.legacy_id";
  created: string[];
  updated: string[];
  unchanged: string[];
  blocked: V1MigrationIssue[];
  failed: V1VerificationFailure[];
  warnings: V1MigrationCompatibilityWarning[];
  summary: {
    created: number;
    updated: number;
    unchanged: number;
    blocked: number;
    failed: number;
    warnings: number;
  };
};

type ApplyOptions = {
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

async function readExistingContents(path: string | null): Promise<ExistingContent[]> {
  if (!path) return [];
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!value || typeof value !== "object") throw new Error("Existing snapshot must be a JSON object.");
  const contents = (value as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) throw new Error("Existing snapshot must contain a contents array.");
  return contents.filter(
    (item): item is ExistingContent => Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

function existingLegacyId(content: ExistingContent): string | null {
  const value = content.legacyId ?? content.legacy_id;
  return typeof value === "string" ? value : null;
}

function comparableCandidate(content: V1MigrationContentRecord): Record<string, unknown> {
  return {
    legacyId: content.legacyId,
    slug: content.slug,
    region: content.region,
    contentType: content.contentType,
    detailLevel: content.detailLevel,
    lifecycle: content.lifecycle,
    growthStage: content.growthStage,
    titleZh: content.titleZh,
    titleEn: content.titleEn,
    summaryZh: content.summaryZh,
    summaryEn: content.summaryEn,
    bodyZhMarkdown: content.bodyZhMarkdown,
    bodyEnMarkdown: content.bodyEnMarkdown,
    contentLanguage: content.contentLanguage,
    primaryCategories: content.primaryCategories,
    coverImagePath: content.cover?.path ?? null,
    coverImageAltZh: content.cover?.altZh ?? null,
    coverImageAltEn: content.cover?.altEn ?? null,
    featured: content.featured,
    manualOrder: content.manualOrder,
    publishedAt: content.publishedAt,
    archivedAt: content.archivedAt,
    lastTendedAt: content.lastTendedAt,
  };
}

function existingField(content: ExistingContent, camel: string, snake: string): unknown {
  return content[camel] !== undefined ? content[camel] : content[snake];
}

function comparableExisting(content: ExistingContent): Record<string, unknown> {
  return {
    legacyId: existingField(content, "legacyId", "legacy_id"),
    slug: content.slug,
    region: content.region,
    contentType: existingField(content, "contentType", "content_type"),
    detailLevel: existingField(content, "detailLevel", "detail_level"),
    lifecycle: content.lifecycle,
    growthStage: existingField(content, "growthStage", "growth_stage"),
    titleZh: existingField(content, "titleZh", "title_zh"),
    titleEn: existingField(content, "titleEn", "title_en"),
    summaryZh: existingField(content, "summaryZh", "summary_zh"),
    summaryEn: existingField(content, "summaryEn", "summary_en"),
    bodyZhMarkdown: existingField(content, "bodyZhMarkdown", "body_zh_markdown"),
    bodyEnMarkdown: existingField(content, "bodyEnMarkdown", "body_en_markdown"),
    contentLanguage: existingField(content, "contentLanguage", "content_language"),
    primaryCategories: existingField(content, "primaryCategories", "primary_categories"),
    coverImagePath: existingField(content, "coverImagePath", "cover_image_path") ?? null,
    coverImageAltZh: existingField(content, "coverImageAltZh", "cover_image_alt_zh") ?? null,
    coverImageAltEn: existingField(content, "coverImageAltEn", "cover_image_alt_en") ?? null,
    featured: content.featured,
    manualOrder: existingField(content, "manualOrder", "manual_order") ?? null,
    publishedAt: existingField(content, "publishedAt", "published_at") ?? null,
    archivedAt: existingField(content, "archivedAt", "archived_at") ?? null,
    lastTendedAt: existingField(content, "lastTendedAt", "last_tended_at") ?? null,
  };
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
  const bundle = transformV1Content();
  const verification = verifyV1MigrationBundle(bundle);
  const failed = [...verification.failed];

  if (options.production) {
    failed.push({
      code: "production_forbidden",
      legacyId: null,
      message: "V1 migration tooling never targets Production.",
    });
  }
  if (options.execute && !options.preview) {
    failed.push({
      code: "preview_flag_required",
      legacyId: null,
      message: "Future execution requires the explicit --preview flag.",
    });
  } else if (options.execute) {
    failed.push({
      code: "writes_not_implemented",
      legacyId: null,
      message: "Preview writes are intentionally not implemented in this phase.",
    });
  }

  let existing: ExistingContent[] = [];
  try {
    existing = await readExistingContents(options.existingPath);
  } catch (error) {
    failed.push({
      code: "invalid_existing_snapshot",
      legacyId: null,
      message: error instanceof Error ? error.message : "Existing snapshot could not be read.",
    });
  }

  const existingByLegacyId = new Map<string, ExistingContent>();
  for (const content of existing) {
    const legacyId = existingLegacyId(content);
    if (!legacyId) continue;
    if (existingByLegacyId.has(legacyId)) {
      failed.push({
        code: "duplicate_existing_legacy_id",
        legacyId,
        message: `Existing snapshot repeats contents.legacy_id ${legacyId}.`,
      });
    }
    existingByLegacyId.set(legacyId, content);
  }

  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const blockedIds = new Set(
    verification.blocked.flatMap((issue) => issue.legacyId ? [issue.legacyId] : []),
  );

  for (const content of bundle.contents) {
    if (blockedIds.has(content.legacyId) || !content.growthStage) continue;
    const current = existingByLegacyId.get(content.legacyId);
    if (!current) {
      created.push(content.legacyId);
    } else if (
      JSON.stringify(comparableCandidate(content)) ===
      JSON.stringify(comparableExisting(current))
    ) {
      unchanged.push(content.legacyId);
    } else {
      updated.push(content.legacyId);
    }
  }

  const report: V1ApplyReport = {
    schemaVersion: 1,
    mode: "dry-run",
    environment: options.preview ? "preview" : "none",
    idempotencyKey: "contents.legacy_id",
    created,
    updated,
    unchanged,
    blocked: verification.blocked,
    failed,
    warnings: verification.warnings,
    summary: {
      created: created.length,
      updated: updated.length,
      unchanged: unchanged.length,
      blocked: verification.blocked.length,
      failed: failed.length,
      warnings: verification.warnings.length,
    },
  };

  return report;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  const options = parseOptions(process.argv.slice(2));
  const report = await buildV1DryRunReport(options);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    await writeFile(options.outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (report.failed.length > 0) process.exitCode = 1;
}
