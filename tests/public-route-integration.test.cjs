/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const integrationPath = path.join(
  projectRoot,
  "lib/content/public-route-integration.ts",
);
const servicePath = path.join(projectRoot, "lib/content/service.ts");
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

const { createPublicRouteIntegration } = require(integrationPath);
const { createContentService } = require(servicePath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

function publicDetail(overrides = {}) {
  return {
    slug: "published-seed",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "full",
    growthStage: "Growing",
    contentLanguage: "en",
    title: "Published seed",
    summary: "Public summary",
    titleZh: null,
    titleEn: "Published seed",
    summaryZh: null,
    summaryEn: "Public summary",
    primaryCategories: ["Coding"],
    tags: [],
    cover: null,
    featured: false,
    publishedAt: "2026-07-16T00:00:00.000Z",
    lastTendedAt: "2026-07-16T00:00:00.000Z",
    bodyMarkdown: "## Public body\n\nVisible content.",
    bodyZhMarkdown: null,
    bodyEnMarkdown: "## Public body\n\nVisible content.",
    growthTimeline: [],
    relations: [],
    ...overrides,
  };
}

function publicCard(overrides = {}) {
  const detail = publicDetail(overrides);
  const {
    bodyMarkdown,
    bodyZhMarkdown,
    bodyEnMarkdown,
    growthTimeline,
    relations,
    ...card
  } = detail;
  void bodyMarkdown;
  void bodyZhMarkdown;
  void bodyEnMarkdown;
  void growthTimeline;
  void relations;
  return card;
}

function archivedContent(overrides = {}) {
  return {
    title: "Resting seed",
    region: "Garden",
    growthStage: "Dormant",
    lifecycle: "Archived",
    restingState: "archived",
    relations: [],
    ...overrides,
  };
}

function integration(overrides = {}) {
  return createPublicRouteIntegration({
    readRoute: async () => ({ kind: "not_found" }),
    listPublished: async () => [],
    ...overrides,
  });
}

test("Published routes provide the public render DTO and safe metadata", async () => {
  const content = publicDetail({
    cover: {
      path: "/covers/published-seed.webp",
      altZh: null,
      altEn: "A public cover",
    },
  });
  const routes = integration({
    readRoute: async () => ({ kind: "published", content }),
  });

  assert.deepEqual(await routes.resolve("Garden", content.slug), {
    kind: "published",
    content,
  });
  const metadata = await routes.metadata("Garden", content.slug);
  assert.equal(metadata.title, "Published seed");
  assert.equal(metadata.description, "Public summary");
  assert.equal(metadata.openGraph.images[0].url, "/covers/published-seed.webp");
  assert.equal(JSON.stringify(metadata).includes("id"), false);
});

test("Draft and Review dispositions remain not found at route integration", async () => {
  for (const lifecycle of ["Draft", "Review"]) {
    const routes = integration({
      readRoute: async () => ({ kind: "not_found" }),
    });
    assert.deepEqual(
      await routes.resolve("Garden", `${lifecycle.toLowerCase()}-seed`),
      { kind: "not_found" },
    );
  }
});

test("Archived routes retain the limited resting state and are noindex", async () => {
  const content = archivedContent();
  const routes = integration({
    readRoute: async () => ({ kind: "archived", content }),
  });

  assert.deepEqual(await routes.resolve("Garden", "resting-seed"), {
    kind: "archived",
    content,
  });
  assert.deepEqual(
    (await routes.metadata("Garden", "resting-seed")).robots,
    { index: false, follow: true },
  );
});

test("invalid slugs fail before any source read", async () => {
  let reads = 0;
  const routes = integration({
    readRoute: async () => {
      reads += 1;
      return { kind: "published", content: publicDetail() };
    },
  });

  for (const slug of ["", "UPPERCASE", "two--hyphens", "../private"]) {
    assert.deepEqual(await routes.resolve("Garden", slug), {
      kind: "not_found",
    });
  }
  assert.equal(reads, 0);
});

test("Region and slug mismatches are rejected without leaking content", async () => {
  const routes = integration({
    readRoute: async () => ({
      kind: "published",
      content: publicDetail({ region: "Forest", slug: "other-seed" }),
    }),
  });

  assert.deepEqual(await routes.resolve("Garden", "published-seed"), {
    kind: "not_found",
  });

  const archivedRoutes = integration({
    readRoute: async () => ({
      kind: "archived",
      content: archivedContent({ region: "Forest" }),
    }),
  });
  assert.deepEqual(await archivedRoutes.resolve("Garden", "resting-seed"), {
    kind: "not_found",
  });
});

test("legacy mode keeps the existing route lookup behavior", async () => {
  const service = createContentService({ mode: "legacy" });
  const routes = createPublicRouteIntegration({
    readRoute: service.getPublicContentRouteDisposition,
    listPublished: service.getPublishedContent,
  });

  const result = await routes.resolve("Garden", "building-the-garden");
  assert.equal(result.kind, "published");
  assert.equal(result.content.title, "Building The Garden");
  assert.equal(result.content.region, "Garden");
});

test("dual-style static params stay database-first, deterministic, and unique", async () => {
  const database = publicCard({ slug: "database-first" });
  const fallback = publicCard({ slug: "legacy-fallback" });
  const routes = integration({
    listPublished: async () => [
      database,
      fallback,
      database,
      publicCard({ region: "Forest", slug: "wrong-region" }),
      publicCard({ slug: "Invalid" }),
    ],
  });

  const expected = [
    { slug: "database-first" },
    { slug: "legacy-fallback" },
  ];
  assert.deepEqual(await routes.generateStaticParams("Garden"), expected);
  assert.deepEqual(await routes.generateStaticParams("Garden"), expected);
});

test("internal Storage identities are not emitted as cover metadata", async () => {
  const internalPath =
    "contents/00000000-0000-4000-8000-00000000a001/cover.webp";
  const routes = integration({
    readRoute: async () => ({
      kind: "published",
      content: publicDetail({
        cover: { path: internalPath, altZh: null, altEn: "Private path" },
      }),
    }),
  });

  const metadata = await routes.metadata("Garden", "published-seed");
  assert.equal(metadata.openGraph, undefined);
  assert.equal(JSON.stringify(metadata).includes(internalPath), false);
});

test("source failures produce safe noindex metadata and no raw error payload", async () => {
  const routes = integration({
    readRoute: async () => {
      throw new Error("database authorization details");
    },
  });

  const metadata = await routes.metadata("Garden", "published-seed");
  assert.deepEqual(metadata, {
    robots: { index: false, follow: false },
  });
  assert.equal(JSON.stringify(metadata).includes("database"), false);
  await assert.rejects(
    routes.resolve("Garden", "published-seed"),
    /database authorization details/,
  );
});

test("all four detail pages use only the public route boundary", () => {
  const routeRegions = new Map([
    ["garden", "Garden"],
    ["forest", "Forest"],
    ["lake", "Lake"],
    ["ruins", "Ruins"],
  ]);

  for (const [route, region] of routeRegions) {
    const source = fs.readFileSync(
      path.join(projectRoot, `app/${route}/[slug]/page.tsx`),
      "utf8",
    );
    assert.match(source, new RegExp(`const region = "${region}" as const`));
    assert.match(source, /resolvePublicContentRoute\(region, slug\)/);
    assert.match(source, /getPublicContentMetadata\(region, slug\)/);
    assert.match(source, /getPublicContentStaticParams\(region\)/);
    assert.match(source, /disposition\.kind === "not_found"/);
    assert.match(source, /disposition\.kind === "archived"/);
    assert.match(source, /<PublicDetailPage item={disposition\.content} \/>/);
    assert.doesNotMatch(source, /@\/content|@\/lib\/supabase|\.find\(/);
    assert.match(source, /dynamicParams = true/);

    const errorSource = fs.readFileSync(
      path.join(projectRoot, `app/${route}/[slug]/error.tsx`),
      "utf8",
    );
    assert.match(errorSource, /public-route-error/);
  }
});
