/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveProjectAlias(
  request,
  parent,
  isMain,
  options,
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options,
  );
};

Module._load = function loadWithBoundaryMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Database read verification must inject its repository.");
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { createContentService } = require(path.join(
  projectRoot,
  "lib/content/service.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const IMPORTED_ROUTES = {
  Garden: [
    "building-the-garden",
    "learning-psychological-statistics",
    "exploring-ai-tools",
    "python-starting-from-the-basics",
    "designing-better-slides-and-documents",
  ],
  Forest: [
    "why-exploratory-websites-invite-more-clicks",
    "does-ai-help-thinking-or-organize-answers",
    "why-people-fear-forgetting",
    "how-psychology-shapes-product-and-web-design",
    "when-a-question-moves-from-forest-to-garden",
  ],
  Lake: [
    "reverse-1999",
    "jung-and-mandala",
    "the-garden",
    "love-love-love",
    "summer-ghost",
  ],
  Ruins: [
    "first-version-of-home",
    "portfolio-never-built",
    "too-much-interaction",
    "unfinished-continue",
  ],
};

const IMPORTED_RELATIONS = [
  ["first-version-of-home", "building-the-garden"],
  ["portfolio-never-built", "the-garden"],
  [
    "too-much-interaction",
    "why-exploratory-websites-invite-more-clicks",
  ],
  ["unfinished-continue", "why-people-fear-forgetting"],
];

const REGION_METADATA = {
  Garden: { contentType: "Seed", growthStage: "Growing" },
  Forest: { contentType: "Question", growthStage: "Sprout" },
  Lake: { contentType: "Reflection", growthStage: null },
  Ruins: { contentType: "Trace", growthStage: "Dormant" },
};

const importedRecords = Object.entries(IMPORTED_ROUTES).flatMap(
  ([region, slugs]) =>
    slugs.map((slug, index) => ({
      region,
      slug,
      contentType: REGION_METADATA[region].contentType,
      growthStage: REGION_METADATA[region].growthStage,
      index,
    })),
);

function databaseRow(record, absoluteIndex) {
  const suffix = String(absoluteIndex + 1).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    slug: record.slug,
    region: record.region,
    content_type: record.contentType,
    detail_level: "full",
    lifecycle: "Published",
    growth_stage: record.growthStage,
    title_zh: `${record.slug} 标题`,
    title_en: `${record.slug} title`,
    summary_zh: `${record.slug} 摘要`,
    summary_en: `${record.slug} summary`,
    body_zh_markdown: `${record.slug} 正文`,
    body_en_markdown: `${record.slug} body`,
    content_language: "bilingual",
    primary_categories: [record.region],
    cover_image_path: null,
    cover_image_alt_zh: null,
    cover_image_alt_en: null,
    featured: false,
    manual_order: null,
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z",
    published_at: "2026-07-19T00:00:00.000Z",
    archived_at: null,
    last_tended_at: null,
  };
}

function importedRepository() {
  const rows = importedRecords.map(databaseRow);
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const relations = IMPORTED_RELATIONS.map(([sourceSlug, targetSlug], index) => ({
    relation: {
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      source_content_id: rowBySlug.get(sourceSlug).id,
      target_content_id: rowBySlug.get(targetSlug).id,
      relation_type: "grewInto",
      note_zh: null,
      note_en: null,
      created_at: "2026-07-19T00:00:00.000Z",
    },
    sourceSlug,
    target: rowBySlug.get(targetSlug),
  }));

  return {
    getPublishedContent: async (query = {}) => {
      let matches = rows;
      if (query.regions?.length) {
        matches = matches.filter((row) => query.regions.includes(row.region));
      }
      return matches.map((row) => ({ row, tags: [`${row.region} imported`] }));
    },
    getPublishedContentByRoute: async (region, slug) => {
      const row = rowBySlug.get(slug);
      if (!row || row.region !== region || row.lifecycle !== "Published") {
        return null;
      }
      return {
        row,
        tags: [`${row.region} imported`],
        growthNotes: [],
        relations: relations
          .filter((relation) => relation.sourceSlug === slug)
          .map(({ relation, target }) => ({ relation, target })),
      };
    },
    resolvePublicContentRoute: async (region, slug) => {
      const row = rowBySlug.get(slug);
      return row && row.region === region && row.lifecycle === "Published"
        ? { kind: "published" }
        : { kind: "not_found", legacyFallbackAllowed: false };
    },
    getUnmigratedRouteKeys: async () => new Set(),
    getPublishedHomeCuration: async () => [],
  };
}

test("database mode reads the imported collection counts as Published records", async () => {
  let legacyReads = 0;
  const service = createContentService({
    mode: "database",
    databaseModeValidation: false,
    repository: importedRepository(),
    legacySource: {
      getPublishedContent: async () => {
        legacyReads += 1;
        return [];
      },
      getPublishedContentByRoute: async () => {
        legacyReads += 1;
        return null;
      },
      getPublishedHomeCuration: async () => {
        legacyReads += 1;
        return [];
      },
    },
  });

  for (const [region, expectedSlugs] of Object.entries(IMPORTED_ROUTES)) {
    const collection = await service.getPublishedContent({ regions: [region] });
    assert.equal(collection.length, expectedSlugs.length, region);
    assert.deepEqual(
      new Set(collection.map(({ slug }) => slug)),
      new Set(expectedSlugs),
      region,
    );
    assert.ok(collection.every((item) => item.region === region), region);
  }

  assert.equal((await service.getPublishedContent()).length, 19);
  assert.equal(legacyReads, 0, "database mode must not read the legacy source");
});

test("database mode reads metadata and Lake null Growth Stages for all 19 routes", async () => {
  const service = createContentService({
    mode: "database",
    databaseModeValidation: false,
    repository: importedRepository(),
  });

  for (const expected of importedRecords) {
    const detail = await service.getPublishedContentByRoute(
      expected.region,
      expected.slug,
    );
    assert.ok(detail, `${expected.region}/${expected.slug}`);
    assert.equal(detail.region, expected.region);
    assert.equal(detail.slug, expected.slug);
    assert.equal(detail.contentType, expected.contentType);
    assert.equal(detail.growthStage, expected.growthStage);
    assert.equal(detail.contentLanguage, "bilingual");
    assert.ok(detail.title.trim());
    assert.ok(detail.summary.trim());
    assert.ok(detail.bodyMarkdown.trim());
    assert.ok(detail.primaryCategories.length > 0);
    assert.ok(detail.tags.length > 0);
  }

  const lake = await service.getPublishedContent({ regions: ["Lake"] });
  assert.equal(lake.length, 5);
  assert.ok(lake.every(({ growthStage }) => growthStage === null));
});

test("database detail reads load all four imported relations", async () => {
  const service = createContentService({
    mode: "database",
    databaseModeValidation: false,
    repository: importedRepository(),
  });
  const loaded = [];

  for (const expected of importedRecords) {
    const detail = await service.getPublishedContentByRoute(
      expected.region,
      expected.slug,
    );
    assert.ok(detail);
    for (const relation of detail.relations) {
      loaded.push([
        expected.slug,
        relation.target.slug,
        relation.relationType,
      ]);
      assert.ok(relation.target.title.trim());
      assert.ok(IMPORTED_ROUTES[relation.target.region].includes(relation.target.slug));
    }
  }

  assert.deepEqual(
    loaded,
    IMPORTED_RELATIONS.map(([source, target]) => [source, target, "grewInto"]),
  );
});
