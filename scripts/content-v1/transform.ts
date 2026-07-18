import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type {
  ContentItem,
  ContentLanguage,
  DetailLevel,
  RegionName,
  V1MigrationBundle,
  V1MigrationCompatibilityWarning,
  V1MigrationContentRecord,
  V1MigrationIssue,
  V1MigrationRelation,
} from "../../types/content.ts";
import type { DetailBlock, DetailContent } from "../../content/details.ts";
import { requiresGrowthStage } from "../../lib/content/validation.ts";

import {
  extractV1Content,
  type V1ExtractManifest,
} from "./extract.ts";

const HAN_TEXT = /\p{Script=Han}/u;

function mapDetailBlockToMarkdown(block: DetailBlock): string {
  if (block.type === "paragraph") return block.text.trim();
  if (block.type === "list") {
    return block.items.map((item) => `- ${item.trim()}`).join("\n");
  }

  return block.items
    .map((note) => `### ${note.title.trim()}\n\n${note.text.trim()}`)
    .join("\n\n");
}

function mapDetailToMarkdown(
  detail: DetailContent | undefined,
  detailLevel: DetailLevel,
): string | null {
  if (!detail) return null;
  if (detailLevel === "short") return detail.explanation?.trim() || null;

  const body = detail.sections
    ?.map((section) => {
      const blocks = section.blocks.map(mapDetailBlockToMarkdown).join("\n\n");
      return `## ${section.title.trim()}\n\n${blocks}`;
    })
    .join("\n\n");

  return body?.trim() || null;
}

function languageField(value: string): "zh" | "en" {
  return HAN_TEXT.test(value) ? "zh" : "en";
}

function mapLanguageFields(item: ContentItem, body: string | null) {
  const titleLanguage = languageField(item.title);
  const summaryLanguage = languageField(item.summary);
  const bodyLanguage = body ? languageField(body) : summaryLanguage;
  const languages = new Set([titleLanguage, summaryLanguage, bodyLanguage]);
  const contentLanguage: ContentLanguage =
    languages.size === 2 ? "mixed" : titleLanguage;

  return {
    titleZh: titleLanguage === "zh" ? item.title : null,
    titleEn: titleLanguage === "en" ? item.title : null,
    summaryZh: summaryLanguage === "zh" ? item.summary : null,
    summaryEn: summaryLanguage === "en" ? item.summary : null,
    bodyZhMarkdown: bodyLanguage === "zh" ? body : null,
    bodyEnMarkdown: bodyLanguage === "en" ? body : null,
    contentLanguage,
  };
}

function toContentRecord(
  item: ContentItem,
  detail: DetailContent | undefined,
): V1MigrationContentRecord {
  const body = mapDetailToMarkdown(detail, item.detailLevel);

  return {
    legacyId: item.id,
    slug: item.slug,
    region: item.region,
    contentType: item.contentType,
    detailLevel: item.detailLevel,
    lifecycle: "Published",
    growthStage: item.status ?? null,
    ...mapLanguageFields(item, body),
    primaryCategories: [...item.categories],
    tags: [...(item.tags ?? [])],
    cover: item.image
      ? { path: item.image, altZh: null, altEn: null }
      : null,
    featured: false,
    manualOrder: null,
    publishedAt: null,
    archivedAt: null,
    lastTendedAt: null,
  };
}

function routeFromPath(path: string): { region: RegionName; slug: string } | null {
  const match = /^\/(garden|forest|lake|ruins)\/([^/?#]+)$/.exec(path);
  if (!match) return null;

  const region = `${match[1][0].toUpperCase()}${match[1].slice(1)}` as RegionName;
  return { region, slug: match[2] };
}

function collectRelations(
  items: ContentItem[],
  ruins: V1ExtractManifest["ruins"],
  issues: V1MigrationIssue[],
): V1MigrationRelation[] {
  const routes = new Map(items.map((item) => [`${item.region}/${item.slug}`, item.id]));

  return ruins.flatMap((item) => {
    if (!item.grewInto) return [];
    const targetRoute = routeFromPath(item.grewInto);
    const targetLegacyId = targetRoute
      ? routes.get(`${targetRoute.region}/${targetRoute.slug}`)
      : undefined;

    if (!targetRoute || !targetLegacyId) {
      issues.push({
        code: "unresolved_relation",
        severity: "blocked",
        legacyId: item.id,
        field: "grewInto",
        message: `Ruins grewInto target does not resolve: ${item.grewInto}.`,
      });
      return [];
    }

    return [{
      sourceLegacyId: item.id,
      targetLegacyId,
      relationType: "grewInto" as const,
      noteZh: null,
      noteEn: null,
    }];
  });
}

const compatibilityWarnings: V1MigrationCompatibilityWarning[] = [
  {
    code: "home_curation_deferred",
    legacyId: null,
    message: "Home curation is empty because the known V1 curation conflicts are deferred.",
  },
  {
    code: "site_copy_deferred",
    legacyId: null,
    message: "Site copy is empty because this phase extracts content modules only.",
  },
  {
    code: "display_overrides_deferred",
    legacyId: null,
    message: "V1 display overrides are deferred and are not migration records.",
  },
  {
    code: "related_paths_not_migrated",
    legacyId: null,
    message: "V1 detail relatedPaths remain presentation navigation; only Ruins grewInto becomes a relation.",
  },
];

export function transformV1Content(
  extract: V1ExtractManifest = extractV1Content(),
): V1MigrationBundle {
  const sourceItems: ContentItem[] = [
    ...extract.garden,
    ...extract.forest,
    ...extract.lake,
    ...extract.ruins,
  ];
  const contents = sourceItems.map((item) =>
    toContentRecord(item, extract.details[item.region][item.slug]),
  );
  const issues: V1MigrationIssue[] = [];

  for (const content of contents) {
    if (
      requiresGrowthStage(content.region, content.contentType) &&
      !content.growthStage
    ) {
      issues.push({
        code: "missing_growth_stage",
        severity: "blocked",
        legacyId: content.legacyId,
        field: "growthStage",
        message: "Growth Stage is missing and must be assigned manually; no value was guessed.",
      });
    }
    if (!content.bodyZhMarkdown && !content.bodyEnMarkdown) {
      issues.push({
        code: "missing_required_field",
        severity: "blocked",
        legacyId: content.legacyId,
        field: "bodyMarkdown",
        message: "No V1 detail body or short-detail explanation resolved.",
      });
    }
  }

  const tagMap = new Map<string, string>();
  const contentTags = contents.flatMap((content) =>
    content.tags.map((displayName) => {
      const normalizedName = displayName.trim().toLocaleLowerCase("en-US");
      tagMap.set(normalizedName, displayName);
      return {
        contentLegacyId: content.legacyId,
        tagNormalizedName: normalizedName,
      };
    }),
  );
  const tags = [...tagMap]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([normalizedName, displayName]) => ({ normalizedName, displayName }));
  const relations = collectRelations(sourceItems, extract.ruins, issues);

  return {
    schemaVersion: 1,
    source: "v1-static-typescript",
    status: issues.some((issue) => issue.severity === "blocked")
      ? "blocked"
      : "ready",
    contents,
    relations,
    tags,
    contentTags,
    homeCuration: [],
    siteCopy: [],
    compatibilityWarnings: structuredClone(compatibilityWarnings),
    issues,
  };
}

export function serializeV1Bundle(bundle: V1MigrationBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  const output = serializeV1Bundle(transformV1Content());
  const outputPath = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--output="))
    ?.slice("--output=".length);
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}
