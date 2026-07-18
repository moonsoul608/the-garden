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
        throw new Error("Preview verification must inject its repository.");
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

const { allContent } = require(path.join(projectRoot, "content/index.ts"));
const {
  PREVIEW_CUTOVER_PUBLIC_SURFACES,
  PREVIEW_CUTOVER_RELATIONS,
  PREVIEW_CUTOVER_ROLLBACK_PATH,
  PREVIEW_CUTOVER_ROUTE_MANIFEST,
  verifyPreviewDatabaseCutover,
} = require(path.join(projectRoot, "lib/content/preview-cutover.ts"));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const lifecycleControls = {
  draft: { region: "Garden", slug: "draft-control" },
  review: { region: "Forest", slug: "review-control" },
  archived: { region: "Ruins", slug: "archived-control" },
};

function databaseRow(item, index) {
  const suffix = String(index + 1).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    slug: item.slug,
    region: item.region,
    content_type: item.contentType,
    detail_level: item.detailLevel,
    lifecycle: "Published",
    growth_stage: item.region === "Lake" ? null : item.status,
    title_zh: item.title,
    title_en: null,
    summary_zh: item.summary,
    summary_en: null,
    body_zh_markdown: `## ${item.title}\n\n${item.summary}`,
    body_en_markdown: null,
    content_language: "zh",
    primary_categories: item.categories,
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

function previewRepository(overrides = {}) {
  const rows = allContent.map(databaseRow);
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const relations = PREVIEW_CUTOVER_RELATIONS.map(
    ([sourceSlug, targetSlug], index) => ({
      sourceSlug,
      relation: {
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        source_content_id: rowBySlug.get(sourceSlug).id,
        target_content_id: rowBySlug.get(targetSlug).id,
        relation_type: "grewInto",
        note_zh: null,
        note_en: null,
        created_at: "2026-07-19T00:00:00.000Z",
      },
      target: rowBySlug.get(targetSlug),
    }),
  );

  return {
    getPublishedContent: async (query = {}) => {
      let matches = rows;
      if (query.regions?.length) {
        matches = matches.filter((row) => query.regions.includes(row.region));
      }
      return matches.map((row) => ({ row, tags: [] }));
    },
    getPublishedContentByRoute: async (region, slug) => {
      const row = rowBySlug.get(slug);
      if (!row || row.region !== region) return null;
      return {
        row,
        tags: [],
        growthNotes: [],
        relations: relations
          .filter((candidate) => candidate.sourceSlug === slug)
          .map(({ relation, target }) => ({ relation, target })),
      };
    },
    resolvePublicContentRoute: async (region, slug) => {
      const row = rowBySlug.get(slug);
      if (row?.region === region) return { kind: "published" };
      if (
        region === lifecycleControls.archived.region &&
        slug === lifecycleControls.archived.slug
      ) {
        return {
          kind: "archived",
          content: {
            title: "Archived control",
            region,
            growthStage: "Dormant",
            lifecycle: "Archived",
            restingState: "archived",
            relations: [],
          },
        };
      }
      return { kind: "not_found", legacyFallbackAllowed: false };
    },
    getUnmigratedRouteKeys: async () => new Set(),
    getPublishedHomeCuration: async () => [],
    ...overrides,
  };
}

test("Preview database verification covers every public render and rollback boundary", async () => {
  const result = await verifyPreviewDatabaseCutover({
    deploymentEnvironment: "preview",
    repository: previewRepository(),
    lifecycleControls,
  });

  assert.deepEqual(PREVIEW_CUTOVER_PUBLIC_SURFACES, [
    "home",
    "garden",
    "forest",
    "lake",
    "ruins",
    "search",
    "garden-index",
  ]);
  assert.equal(
    Object.values(PREVIEW_CUTOVER_ROUTE_MANIFEST).flat().length,
    19,
  );
  assert.deepEqual(PREVIEW_CUTOVER_ROLLBACK_PATH, [
    "database",
    "dual",
    "legacy",
  ]);
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.previewOnly, true);
  assert.equal(result.cutoverExecuted, false);
  assert.equal(result.productionCutoverAuthorized, false);
  assert.equal(result.defaultSourceModeChanged, false);
  assert.equal(result.publicSurfaceCount, 7);
  assert.equal(result.detailRouteCount, 19);
  assert.deepEqual(result.blockingCheckIds, []);
  assert.ok(result.checks.every(({ status }) => status === "PASS"));
});

test("Preview verification blocks Production scope and incomplete database renders", async () => {
  const incompleteRepository = previewRepository({
    getPublishedContent: async (query = {}) => {
      const rows = allContent.slice(0, 18).map(databaseRow);
      const matches = query.regions?.length
        ? rows.filter((row) => query.regions.includes(row.region))
        : rows;
      return matches.map((row) => ({ row, tags: [] }));
    },
  });
  const result = await verifyPreviewDatabaseCutover({
    deploymentEnvironment: "production",
    repository: incompleteRepository,
    lifecycleControls,
  });

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockingCheckIds.includes("preview_scope"));
  assert.ok(result.blockingCheckIds.includes("public_surfaces"));
  assert.ok(result.blockingCheckIds.includes("sitemap"));
  assert.equal(result.cutoverExecuted, false);
  assert.equal(result.productionCutoverAuthorized, false);
});

test("all source-dependent public pages read through the shared service", () => {
  const pages = [
    "app/page.tsx",
    "app/garden/page.tsx",
    "app/forest/page.tsx",
    "app/lake/page.tsx",
    "app/ruins/page.tsx",
    "app/search/page.tsx",
    "app/(utilities)/garden-index/page.tsx",
  ];

  for (const page of pages) {
    const source = fs.readFileSync(path.join(projectRoot, page), "utf8");
    assert.match(source, /getPublishedContent/);
    assert.match(source, /presentPublicContentCard/);
    assert.doesNotMatch(
      source,
      /@\/content\/(garden|forest|lake|ruins)/,
      page,
    );
  }
});
