/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const servicePath = path.join(projectRoot, "lib/content/service.ts");
const repositoryPath = path.join(projectRoot, "lib/content/repository.ts");
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
        throw new Error("A test must inject the repository.");
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

const { createContentService } = require(servicePath);
const { createContentRepository } = require(repositoryPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

function databaseRow(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-00000000a001",
    slug: "published-seed",
    region: "Garden",
    content_type: "Seed",
    detail_level: "full",
    lifecycle: "Published",
    growth_stage: "Growing",
    title_zh: null,
    title_en: "Published seed",
    summary_zh: null,
    summary_en: "Public summary",
    body_zh_markdown: null,
    body_en_markdown: "Public body",
    content_language: "en",
    primary_categories: ["Coding"],
    cover_image_path: null,
    cover_image_alt_zh: null,
    cover_image_alt_en: null,
    featured: false,
    manual_order: null,
    created_at: "2026-07-16T00:00:00.000Z",
    updated_at: "2026-07-16T00:00:00.000Z",
    published_at: "2026-07-16T00:00:00.000Z",
    archived_at: null,
    last_tended_at: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

function publicCard(overrides = {}) {
  return {
    slug: "legacy-seed",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "short",
    growthStage: "Seed",
    contentLanguage: null,
    title: "Legacy seed",
    summary: "Legacy summary",
    titleZh: null,
    titleEn: null,
    summaryZh: null,
    summaryEn: null,
    primaryCategories: ["Coding"],
    tags: [],
    cover: null,
    featured: false,
    publishedAt: null,
    lastTendedAt: null,
    ...overrides,
  };
}

function publicDetail(overrides = {}) {
  return {
    ...publicCard(overrides),
    bodyMarkdown: "Legacy body",
    bodyZhMarkdown: null,
    bodyEnMarkdown: null,
    growthTimeline: [],
    relations: [],
  };
}

function archivedContent() {
  return {
    title: "Resting seed",
    region: "Garden",
    growthStage: "Dormant",
    lifecycle: "Archived",
    restingState: "archived",
    relations: [
      {
        relationType: "grewInto",
        target: {
          slug: "published-target",
          region: "Forest",
          growthStage: "Growing",
          title: "Published target",
        },
      },
    ],
  };
}

function repositoryStub(overrides = {}) {
  return {
    getPublishedContent: async () => [],
    getPublishedContentByRoute: async () => null,
    resolvePublicContentRoute: async () => ({
      kind: "not_found",
      legacyFallbackAllowed: true,
    }),
    getUnmigratedRouteKeys: async (routes) =>
      new Set(routes.map(({ region, slug }) => `${region}/${slug}`)),
    getPublishedHomeCuration: async () => [],
    ...overrides,
  };
}

function legacySourceStub(overrides = {}) {
  return {
    getPublishedContent: async () => [],
    getPublishedContentByRoute: async () => null,
    getPublishedHomeCuration: async () => [],
    ...overrides,
  };
}

test("Published route returns the normal published DTO", async () => {
  const row = databaseRow();
  const service = createContentService({
    mode: "database",
    repository: repositoryStub({
      resolvePublicContentRoute: async () => ({ kind: "published" }),
      getPublishedContentByRoute: async () => ({
        row,
        tags: ["Public"],
        growthNotes: [],
        relations: [],
      }),
    }),
    legacySource: legacySourceStub(),
  });

  const result = await service.getPublicContentRouteDisposition(
    "Garden",
    row.slug,
  );

  assert.equal(result.kind, "published");
  assert.equal(result.content.title, "Published seed");
  assert.equal(result.content.summary, "Public summary");
  assert.equal(result.content.bodyMarkdown, "Public body");
  assert.equal("id" in result.content, false);
});

test("database mode reads only Published collection records", async () => {
  const published = databaseRow();
  const service = createContentService({
    mode: "database",
    repository: repositoryStub({
      getPublishedContent: async () => [
        { row: published, tags: ["Public"] },
        {
          row: databaseRow({
            id: "00000000-0000-4000-8000-00000000a002",
            slug: "draft-seed",
            lifecycle: "Draft",
          }),
          tags: ["Private"],
        },
        {
          row: databaseRow({
            id: "00000000-0000-4000-8000-00000000a003",
            slug: "review-seed",
            lifecycle: "Review",
          }),
          tags: ["Private"],
        },
      ],
    }),
    legacySource: legacySourceStub(),
  });

  const results = await service.getPublishedContent();

  assert.deepEqual(results.map(({ slug }) => slug), ["published-seed"]);
  assert.equal("id" in results[0], false);
  assert.equal("lifecycle" in results[0], false);
});

test("Archived route returns the dedicated resting DTO", async () => {
  const resting = archivedContent();
  const service = createContentService({
    mode: "database",
    repository: repositoryStub({
      resolvePublicContentRoute: async () => ({
        kind: "archived",
        content: resting,
      }),
    }),
    legacySource: legacySourceStub(),
  });

  const result = await service.getPublicContentRouteDisposition(
    "Garden",
    "resting-seed",
  );

  assert.deepEqual(result, { kind: "archived", content: resting });
});

for (const lifecycle of ["Draft", "Review"]) {
  test(`${lifecycle} route behaves as not found`, async () => {
    let legacyReads = 0;
    const service = createContentService({
      mode: "dual",
      repository: repositoryStub({
        resolvePublicContentRoute: async () => ({
          kind: "not_found",
          legacyFallbackAllowed: false,
        }),
      }),
      legacySource: legacySourceStub({
        getPublishedContentByRoute: async () => {
          legacyReads += 1;
          return publicDetail();
        },
      }),
    });

    assert.deepEqual(
      await service.getPublicContentRouteDisposition("Garden", "legacy-seed"),
      { kind: "not_found" },
    );
    assert.equal(legacyReads, 0);
  });
}

test("Archived payload excludes private and editorial fields", async () => {
  const rpcPayload = {
    ...archivedContent(),
    bodyMarkdown: "must be dropped",
    summary: "must be dropped",
    growthTimeline: [{ noteEn: "must be dropped" }],
    archivedBy: "must be dropped",
    archiveReason: "must be dropped",
    cover: { path: "must-be-dropped.webp" },
  };
  rpcPayload.relations[0].noteEn = "must be dropped";
  const repository = createContentRepository({
    rpc: async () => ({
      data: { disposition: "archived", content: rpcPayload },
      error: null,
    }),
  });
  const disposition = await repository.resolvePublicContentRoute(
    "Garden",
    "resting-seed",
  );
  const resting = disposition.content;

  assert.deepEqual(Object.keys(resting).sort(), [
    "growthStage",
    "lifecycle",
    "region",
    "relations",
    "restingState",
    "title",
  ]);
  assert.deepEqual(Object.keys(resting.relations[0]).sort(), [
    "relationType",
    "target",
  ]);
  assert.deepEqual(Object.keys(resting.relations[0].target).sort(), [
    "growthStage",
    "region",
    "slug",
    "title",
  ]);
  for (const forbidden of [
    "body",
    "bodyMarkdown",
    "summary",
    "growthTimeline",
    "archiveReason",
    "archivedBy",
    "cover",
  ]) {
    assert.equal(forbidden in resting, false);
  }
});

test("Archived Lake payload safely preserves intentional null Growth Stage", async () => {
  const resting = archivedContent();
  resting.title = "Resting reflection";
  resting.region = "Lake";
  resting.growthStage = null;
  resting.relations[0].target.region = "Lake";
  resting.relations[0].target.growthStage = null;
  const repository = createContentRepository({
    rpc: async () => ({
      data: { disposition: "archived", content: resting },
      error: null,
    }),
  });

  const disposition = await repository.resolvePublicContentRoute(
    "Lake",
    "resting-reflection",
  );
  assert.equal(disposition.kind, "archived");
  assert.equal(disposition.content.growthStage, null);
  assert.equal(disposition.content.relations[0].target.growthStage, null);
});

test("Published response contract drops internal, admin, and migration fields", async () => {
  const row = databaseRow({
    legacy_id: "legacy-seed",
    created_by: "keeper-id",
    updated_by: "keeper-id",
    migration: { source: "v1" },
  });
  const target = databaseRow({
    id: "00000000-0000-4000-8000-00000000a004",
    slug: "related-seed",
  });
  const service = createContentService({
    mode: "database",
    repository: repositoryStub({
      resolvePublicContentRoute: async () => ({ kind: "published" }),
      getPublishedContentByRoute: async () => ({
        row,
        tags: ["Public"],
        growthNotes: [
          {
            id: "00000000-0000-4000-8000-00000000b001",
            content_id: row.id,
            from_stage: "Sprout",
            to_stage: "Growing",
            note_zh: null,
            note_en: "A public change",
            occurred_at: "2026-07-16T00:00:00.000Z",
            is_public: true,
            created_at: "2026-07-16T00:00:00.000Z",
          },
        ],
        relations: [
          {
            relation: {
              id: "00000000-0000-4000-8000-00000000c001",
              source_content_id: row.id,
              target_content_id: target.id,
              relation_type: "relatedTo",
              note_zh: null,
              note_en: "A public relation",
              created_at: "2026-07-16T00:00:00.000Z",
            },
            target,
          },
        ],
      }),
    }),
    legacySource: legacySourceStub(),
  });

  const result = await service.getPublishedContentByRoute("Garden", row.slug);
  const serialized = JSON.stringify(result);

  assert.ok(result);
  assert.equal("id" in result, false);
  assert.equal("id" in result.growthTimeline[0], false);
  assert.equal("id" in result.relations[0], false);
  assert.equal("id" in result.relations[0].target, false);
  assert.equal("manualOrder" in result, false);
  for (const forbidden of [
    "legacy_id",
    "legacyId",
    "created_by",
    "createdBy",
    "updated_by",
    "updatedBy",
    "migration",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("dual mode keeps tombstoned routes from legacy fallback", async () => {
  let legacyReads = 0;
  const service = createContentService({
    mode: "dual",
    repository: repositoryStub({
      resolvePublicContentRoute: async () => ({
        kind: "not_found",
        legacyFallbackAllowed: false,
      }),
    }),
    legacySource: legacySourceStub({
      getPublishedContentByRoute: async () => {
        legacyReads += 1;
        return publicDetail();
      },
    }),
  });

  assert.deepEqual(
    await service.getPublicContentRouteDisposition("Garden", "deleted-seed"),
    { kind: "not_found" },
  );
  assert.equal(legacyReads, 0);
});

test("Dual mode does not resurrect Archived V1 route content", async () => {
  let legacyReads = 0;
  const service = createContentService({
    mode: "dual",
    repository: repositoryStub({
      resolvePublicContentRoute: async () => ({
        kind: "archived",
        content: archivedContent(),
      }),
    }),
    legacySource: legacySourceStub({
      getPublishedContentByRoute: async () => {
        legacyReads += 1;
        return publicDetail();
      },
    }),
  });

  const result = await service.getPublicContentRouteDisposition(
    "Garden",
    "legacy-seed",
  );
  assert.equal(result.kind, "archived");
  assert.equal(legacyReads, 0);
  assert.equal(
    await service.getPublishedContentByRoute("Garden", "legacy-seed"),
    null,
  );
});

test("Dual-mode public collections include only Published and unmigrated content", async () => {
  const published = databaseRow();
  const archivedLegacy = publicCard({
    slug: "archived-legacy",
    title: "Archived legacy",
  });
  const unmigratedLegacy = publicCard({
    slug: "unmigrated-legacy",
    title: "Unmigrated legacy",
  });
  const service = createContentService({
    mode: "dual",
    repository: repositoryStub({
      getPublishedContent: async () => [{ row: published, tags: [] }],
      getUnmigratedRouteKeys: async () =>
        new Set(["Garden/unmigrated-legacy"]),
    }),
    legacySource: legacySourceStub({
      getPublishedContent: async () => [archivedLegacy, unmigratedLegacy],
    }),
  });

  const results = await service.getPublishedContent();
  assert.deepEqual(
    results.map(({ title }) => title),
    ["Published seed", "Unmigrated legacy"],
  );
});

test("legacy mode remains static-only and preserves source order", async () => {
  let repositoryReads = 0;
  const legacyItems = [
    publicCard({ slug: "legacy-first", title: "Legacy first" }),
    publicCard({ slug: "legacy-second", title: "Legacy second" }),
  ];
  const service = createContentService({
    mode: "legacy",
    repository: repositoryStub({
      getPublishedContent: async () => {
        repositoryReads += 1;
        return [{ row: databaseRow(), tags: [] }];
      },
    }),
    legacySource: legacySourceStub({
      getPublishedContent: async () => legacyItems,
    }),
  });

  assert.deepEqual(await service.getPublishedContent(), legacyItems);
  assert.equal(repositoryReads, 0);
});

test("dual mode is deterministic, database-first, and route-deduplicated", async () => {
  const published = databaseRow();
  const duplicateLegacy = publicCard({
    slug: published.slug,
    title: "Stale legacy copy",
  });
  const unmigratedLegacy = publicCard({
    slug: "unmigrated-legacy",
    title: "Unmigrated legacy",
  });
  const service = createContentService({
    mode: "dual",
    repository: repositoryStub({
      getPublishedContent: async () => [{ row: published, tags: [] }],
      getUnmigratedRouteKeys: async () =>
        new Set(["Garden/unmigrated-legacy"]),
    }),
    legacySource: legacySourceStub({
      getPublishedContent: async () => [
        unmigratedLegacy,
        duplicateLegacy,
        unmigratedLegacy,
      ],
    }),
  });

  const first = await service.getPublishedContent();
  const second = await service.getPublishedContent();

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map(({ title }) => title),
    ["Published seed", "Unmigrated legacy"],
  );
});

test("Normal public queries still exclude Archived lifecycle", async () => {
  let repositoryReads = 0;
  const service = createContentService({
    mode: "database",
    repository: repositoryStub({
      getPublishedContent: async () => {
        repositoryReads += 1;
        return [];
      },
    }),
    legacySource: legacySourceStub(),
  });

  assert.deepEqual(
    await service.getPublishedContent({ lifecycles: ["Archived"] }),
    [],
  );
  assert.equal(repositoryReads, 0);
});
