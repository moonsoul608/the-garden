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

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

Module._load = function loadWithAdminVerificationMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000008d31",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Admin verification must inject its repository.");
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

const { createAdminContentManagementService } = require(path.join(
  projectRoot,
  "lib/content/admin/content-management-service.ts",
));
const { createContentManagementReadRepository } = require(path.join(
  projectRoot,
  "lib/content/admin/content-management-repository.ts",
));
const { getAdminGrowthPresentation } = require(path.join(
  projectRoot,
  "lib/content/admin/content-management-presentation.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const IMPORTED_CONTENT = {
  Garden: [
    ["building-the-garden", "Growing"],
    ["learning-psychological-statistics", "Growing"],
    ["exploring-ai-tools", "Sprout"],
    ["python-starting-from-the-basics", "Sprout"],
    ["designing-better-slides-and-documents", "Sprout"],
  ],
  Forest: [
    ["why-exploratory-websites-invite-more-clicks", "Sprout"],
    ["does-ai-help-thinking-or-organize-answers", "Seed"],
    ["why-people-fear-forgetting", "Sprout"],
    ["how-psychology-shapes-product-and-web-design", "Sprout"],
    ["when-a-question-moves-from-forest-to-garden", "Seed"],
  ],
  Lake: [
    ["reverse-1999", null],
    ["jung-and-mandala", null],
    ["the-garden", null],
    ["love-love-love", null],
    ["summer-ghost", null],
  ],
  Ruins: [
    ["first-version-of-home", "Dormant"],
    ["portfolio-never-built", "Dormant"],
    ["too-much-interaction", "Dormant"],
    ["unfinished-continue", "Dormant"],
  ],
};

const importedRecords = Object.entries(IMPORTED_CONTENT).flatMap(
  ([region, records]) =>
    records.map(([slug, growthStage]) => ({ region, slug, growthStage })),
);

function contentRow(record, absoluteIndex) {
  return {
    id: `00000000-0000-4000-8000-${String(absoluteIndex + 1).padStart(12, "0")}`,
    lifecycle: "Published",
    title_zh: null,
    title_en: record.slug,
    region: record.region,
    growth_stage: record.growthStage,
    updated_at: new Date(Date.UTC(2026, 6, 19, 0, absoluteIndex)).toISOString(),
  };
}

function adminDatabaseClient(contentRows) {
  return {
    from(table) {
      assert.ok(
        table === "contents" || table === "content_revisions",
        `unexpected Admin table read: ${table}`,
      );
      return {
        select() {
          if (table === "contents") {
            return { order: async () => ({ data: contentRows, error: null }) };
          }
          return { in: async () => ({ data: [], error: null }) };
        },
      };
    },
  };
}

test("Keeper Admin lists all 19 imported database contents with their Regions", async () => {
  const rows = importedRecords.map(contentRow);
  const repository = createContentManagementReadRepository(adminDatabaseClient(rows));
  const service = createAdminContentManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-000000008d31" }),
    repository,
  });

  const content = await service.listContent();

  assert.equal(content.length, 19);
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(IMPORTED_CONTENT).map((region) => [
        region,
        content.filter((item) => item.region === region).length,
      ]),
    ),
    { Garden: 5, Forest: 5, Lake: 5, Ruins: 4 },
  );
  assert.deepEqual(
    new Set(content.map(({ title }) => title)),
    new Set(importedRecords.map(({ slug }) => slug)),
  );
  assert.ok(content.every(({ lifecycle }) => lifecycle === "Published"));
  assert.ok(content.every(({ revisionId }) => revisionId === null));
});

test("Admin renders Lake nulls as not tracked and exact non-Lake Growth Stages", () => {
  for (const record of importedRecords) {
    const presentation = getAdminGrowthPresentation(record.growthStage);
    if (record.region === "Lake") {
      assert.deepEqual(presentation, {
        label: "Not growth-tracked",
        marker: null,
      });
    } else {
      assert.equal(presentation.label, record.growthStage, record.slug);
      assert.ok(presentation.marker, record.slug);
    }
  }
});

test("Admin workspace uses the verified Growth presentation boundary", () => {
  const page = fs.readFileSync(
    path.join(projectRoot, "app/admin/(protected)/content/page.tsx"),
    "utf8",
  );
  assert.match(page, /getAdminGrowthPresentation\(item\.growthStage\)/);
  assert.match(page, /\{growth\.label\}/);
  assert.match(page, /\{growth\.marker\}/);
});
