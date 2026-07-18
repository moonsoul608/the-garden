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

const { ContentRepositoryError, ContentServiceError } = require(path.join(
  projectRoot,
  "lib/content/errors.ts",
));
const {
  getDatabaseModeValidationProbes,
  resolveContentSourceConfiguration,
  validateDatabaseMode,
} = require(path.join(projectRoot, "lib/content/source-cutover.ts"));
const { createContentService, getContentSourceMode } = require(path.join(
  projectRoot,
  "lib/content/service.ts",
));
const { getSupabasePublicConfig } = require(path.join(
  projectRoot,
  "lib/supabase/config.ts",
));
const { createPublicRouteIntegration } = require(path.join(
  projectRoot,
  "lib/content/public-route-integration.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const probes = {
  published: { region: "Garden", slug: "published-seed" },
  draft: { region: "Garden", slug: "draft-seed" },
  review: { region: "Forest", slug: "review-question" },
  archived: { region: "Ruins", slug: "archived-trace" },
};

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

function publishedDetail(region = "Garden", slug = "published-seed") {
  return {
    slug,
    region,
    contentType: region === "Garden" ? "Seed" : "Question",
    detailLevel: "full",
    growthStage: "Growing",
    contentLanguage: "en",
    title: "Published path",
    summary: "Public summary",
    titleZh: null,
    titleEn: "Published path",
    summaryZh: null,
    summaryEn: "Public summary",
    primaryCategories: ["Public"],
    tags: [],
    cover: null,
    featured: false,
    publishedAt: null,
    lastTendedAt: null,
    bodyMarkdown: "Public body",
    bodyZhMarkdown: null,
    bodyEnMarkdown: "Public body",
    growthTimeline: [],
    relations: [],
  };
}

function archivedContent(region = "Ruins") {
  return {
    title: "Resting path",
    region,
    growthStage: "Dormant",
    lifecycle: "Archived",
    restingState: "archived",
    relations: [],
  };
}

function repositoryStub(overrides = {}) {
  const row = databaseRow();
  return {
    getPublishedContent: async () => [{ row, tags: [] }],
    getPublishedContentByRoute: async () => ({
      row,
      tags: [],
      growthNotes: [],
      relations: [],
    }),
    resolvePublicContentRoute: async (region, slug) => {
      if (region === probes.published.region && slug === probes.published.slug) {
        return { kind: "published" };
      }
      if (region === probes.archived.region && slug === probes.archived.slug) {
        return { kind: "archived", content: archivedContent(region) };
      }
      return { kind: "not_found", legacyFallbackAllowed: false };
    },
    getUnmigratedRouteKeys: async () => new Set(),
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

test("database is the default while explicit legacy and adjacent transitions remain available", () => {
  assert.deepEqual(resolveContentSourceConfiguration({}), {
    mode: "database",
    previousMode: null,
    transition: null,
  });
  assert.equal(getContentSourceMode({}), "database");
  assert.deepEqual(
    resolveContentSourceConfiguration({ CONTENT_SOURCE_MODE: "legacy" }),
    { mode: "legacy", previousMode: null, transition: null },
  );

  for (const [previousMode, mode] of [
    ["legacy", "dual"],
    ["dual", "database"],
    ["database", "dual"],
    ["dual", "legacy"],
  ]) {
    assert.deepEqual(
      resolveContentSourceConfiguration({
        CONTENT_SOURCE_MODE: mode,
        CONTENT_SOURCE_PREVIOUS_MODE: previousMode,
        CONTENT_SOURCE_MODE_CONFIRM: mode,
      }),
      {
        mode,
        previousMode,
        transition: `${previousMode}->${mode}`,
      },
    );
  }

  assert.throws(
    () =>
      resolveContentSourceConfiguration({
        CONTENT_SOURCE_MODE: "database",
        CONTENT_SOURCE_PREVIOUS_MODE: "legacy",
        CONTENT_SOURCE_MODE_CONFIRM: "database",
      }),
    /Only adjacent/,
  );
  assert.throws(
    () => resolveContentSourceConfiguration({ CONTENT_SOURCE_MODE: "dual" }),
    /requires CONTENT_SOURCE_PREVIOUS_MODE/,
  );
});

test("database validation probe routes are explicit and strictly parsed", () => {
  assert.deepEqual(
    getDatabaseModeValidationProbes({
      CONTENT_DATABASE_PUBLISHED_PROBE: "/garden/published-seed",
      CONTENT_DATABASE_DRAFT_PROBE: "/garden/draft-seed",
      CONTENT_DATABASE_REVIEW_PROBE: "/forest/review-question",
      CONTENT_DATABASE_ARCHIVED_PROBE: "/ruins/archived-trace",
    }),
    probes,
  );
  assert.throws(
    () =>
      getDatabaseModeValidationProbes({
        CONTENT_DATABASE_PUBLISHED_PROBE: "/garden/../private",
      }),
    /must be a valid/,
  );
});

test("database mode validation proves adapter, public queries, and lifecycle controls", async () => {
  await validateDatabaseMode(repositoryStub(), probes);
});

test("public database configuration accepts the project URL and standard REST endpoint", () => {
  const publishableKey = "test-publishable-key";
  assert.deepEqual(
    getSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/rest/v1/",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    }),
    {
      url: "https://example.supabase.co",
      publishableKey,
    },
  );
  assert.throws(
    () =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/private/path",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    /project base URL/,
  );
});

test("the absent-mode default reads only the database adapter", async () => {
  let legacyReads = 0;
  const service = createContentService({
    environment: {},
    repository: repositoryStub(),
    legacySource: legacySourceStub({
      getPublishedContent: async () => {
        legacyReads += 1;
        return [];
      },
    }),
  });

  const items = await service.getPublishedContent();
  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "published-seed");
  assert.equal(legacyReads, 0);
});

test("database Published details do not depend on fallback disposition lookup", async () => {
  let dispositionReads = 0;
  const service = createContentService({
    environment: {},
    repository: repositoryStub({
      resolvePublicContentRoute: async () => {
        dispositionReads += 1;
        throw new Error("Published database details must resolve directly.");
      },
    }),
  });

  const detail = await service.getPublishedContentByRoute(
    probes.published.region,
    probes.published.slug,
  );
  assert.equal(detail?.slug, probes.published.slug);
  assert.equal(dispositionReads, 0);
});

test("an explicit database transition retains lifecycle admission validation", async () => {
  let validationCollectionReads = 0;
  const service = createContentService({
    environment: {
      CONTENT_SOURCE_MODE: "database",
      CONTENT_SOURCE_PREVIOUS_MODE: "dual",
      CONTENT_SOURCE_MODE_CONFIRM: "database",
      CONTENT_DATABASE_PUBLISHED_PROBE: "/garden/published-seed",
      CONTENT_DATABASE_DRAFT_PROBE: "/garden/draft-seed",
      CONTENT_DATABASE_REVIEW_PROBE: "/forest/review-question",
      CONTENT_DATABASE_ARCHIVED_PROBE: "/ruins/archived-trace",
    },
    repository: repositoryStub({
      getPublishedContent: async () => {
        validationCollectionReads += 1;
        return [{ row: databaseRow(), tags: [] }];
      },
    }),
  });

  await service.getPublishedContent();
  assert.equal(validationCollectionReads, 2);
});

test("failed database validation fails closed without legacy fallback or raw errors", async () => {
  let legacyReads = 0;
  const service = createContentService({
    mode: getContentSourceMode({}),
    databaseModeValidation: probes,
    repository: repositoryStub({
      getPublishedContent: async () => {
        throw new Error("private database connection details");
      },
    }),
    legacySource: legacySourceStub({
      getPublishedContent: async () => {
        legacyReads += 1;
        return [];
      },
    }),
  });

  await assert.rejects(service.getPublishedContent(), (error) => {
    assert.ok(error instanceof ContentServiceError);
    assert.equal(error.code, "database_validation_failed");
    assert.doesNotMatch(error.message, /private|connection/i);
    return true;
  });
  assert.equal(legacyReads, 0);
});

test("database validation completes once before database reads are allowed", async () => {
  let collectionReads = 0;
  const repository = repositoryStub({
    getPublishedContent: async () => {
      collectionReads += 1;
      return [{ row: databaseRow(), tags: [] }];
    },
  });
  const service = createContentService({
    mode: "database",
    databaseModeValidation: probes,
    repository,
    legacySource: legacySourceStub(),
  });

  await service.getPublishedContent();
  await service.getPublishedContent();
  assert.equal(collectionReads, 3);
});

test("dual mode fails closed when the database cannot authorize fallback", async () => {
  let legacyReads = 0;
  const service = createContentService({
    mode: "dual",
    repository: repositoryStub({
      getPublishedContent: async () => {
        throw new ContentRepositoryError("readPublishedContent");
      },
    }),
    legacySource: legacySourceStub({
      getPublishedContent: async () => {
        legacyReads += 1;
        return [publishedDetail()];
      },
    }),
  });

  await assert.rejects(service.getPublishedContent(), {
    code: "repository_failure",
  });
  assert.equal(legacyReads, 0);
});

test("all four detail route families preserve Published, private, Archived, and 404 states", async () => {
  const regions = ["Garden", "Forest", "Lake", "Ruins"];

  for (const region of regions) {
    const routes = createPublicRouteIntegration({
      readRoute: async (_requestedRegion, slug) => {
        if (slug === "published-path") {
          return {
            kind: "published",
            content: publishedDetail(region, slug),
          };
        }
        if (slug === "archived-path") {
          return { kind: "archived", content: archivedContent(region) };
        }
        return { kind: "not_found" };
      },
      listPublished: async () => [],
    });

    assert.equal((await routes.resolve(region, "published-path")).kind, "published");
    assert.deepEqual(await routes.resolve(region, "draft-path"), {
      kind: "not_found",
    });
    assert.deepEqual(await routes.resolve(region, "review-path"), {
      kind: "not_found",
    });
    assert.equal((await routes.resolve(region, "archived-path")).kind, "archived");
    assert.deepEqual(await routes.resolve(region, "missing-path"), {
      kind: "not_found",
    });
  }
});

test("the four route pages retain safe render branches and error boundaries", () => {
  for (const route of ["garden", "forest", "lake", "ruins"]) {
    const page = fs.readFileSync(
      path.join(projectRoot, `app/${route}/[slug]/page.tsx`),
      "utf8",
    );
    const error = fs.readFileSync(
      path.join(projectRoot, `app/${route}/[slug]/error.tsx`),
      "utf8",
    );
    assert.match(page, /disposition\.kind === "not_found"/);
    assert.match(page, /disposition\.kind === "archived"/);
    assert.match(page, /<PublicDetailPage item={disposition\.content} \/>/);
    assert.match(error, /public-route-error/);
  }
});
