/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const servicePath = path.join(
  projectRoot,
  "lib/content/admin/home-curation-service.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/home-curation-repository.ts",
);
const pagePath = path.join(
  projectRoot,
  "app/admin/(protected)/home/page.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/home/actions.ts",
);
const actionContractsPath = path.join(
  projectRoot,
  "app/admin/(protected)/home/action-contracts.ts",
);
const formPath = path.join(
  projectRoot,
  "app/admin/(protected)/home/home-curation-form.tsx",
);
const layoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
const adminIndexPath = path.join(projectRoot, "lib/content/admin/index.ts");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;
const revalidatedPaths = [];

class MockHomeCurationInputError extends Error {}
class MockHomeCurationManagementUnavailableError extends Error {}

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

Module._load = function loadWithHomeCurationMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/cache") {
    return { revalidatePath: (route) => revalidatedPaths.push(route) };
  }
  if (request === "@/lib/content/admin" && parent?.filename === actionsPath) {
    return {
      HomeCurationInputError: MockHomeCurationInputError,
      HomeCurationManagementUnavailableError:
        MockHomeCurationManagementUnavailableError,
      createHomeCurationManagementService: () => ({
        saveHomeCuration: async () => {},
      }),
    };
  }
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-00000000aa21",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the home curation repository.");
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

const {
  HomeCurationInputError,
  createHomeCurationManagementService,
} = require(servicePath);
const { createHomeCurationRepository } = require(repositoryPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const contentIdA = "00000000-0000-4000-8000-00000000ca01";
const contentIdB = "00000000-0000-4000-8000-00000000ca02";
const updatedAt = "2026-07-29T10:00:00.000Z";

function option(overrides = {}) {
  return {
    contentId: contentIdA,
    title: "A Published Path",
    region: "Garden",
    growthStage: "Growing",
    updatedAt,
    ...overrides,
  };
}

function form(fields) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) formData.append(key, item);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

test("home curation service authorizes before reading workspace", async () => {
  const calls = [];
  const service = createHomeCurationManagementService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: {
      listPublishedContentOptions: async () => {
        calls.push("options");
        return [option()];
      },
      listHomeCurationRows: async () => {
        calls.push("curation");
        return [
          {
            content_id: contentIdA,
            slot: "currentlyGrowing",
            sort_order: 0,
            created_at: updatedAt,
            updated_at: updatedAt,
          },
        ];
      },
      replaceHomeCuration: async () => {
        throw new Error("replaceHomeCuration was not expected");
      },
    },
  });

  const workspace = await service.getWorkspace();

  assert.equal(workspace.slots.currentlyGrowing[0].contentId, contentIdA);
  assert.equal(workspace.slots.recentlyPlanted.length, 0);
  assert.equal(calls[0], "authorize");
  assert.deepEqual(new Set(calls.slice(1)), new Set(["options", "curation"]));
});

test("home curation service blocks unauthorized reads before repository access", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  const service = createHomeCurationManagementService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listPublishedContentOptions: async () => {
        repositoryCalls += 1;
        return [];
      },
      listHomeCurationRows: async () => {
        repositoryCalls += 1;
        return [];
      },
      replaceHomeCuration: async () => {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(service.getWorkspace(), (error) => error === denied);
  assert.equal(repositoryCalls, 0);
});

test("home curation service validates duplicate selections before mutation access", async () => {
  let authorized = false;
  const service = createHomeCurationManagementService({
    authorize: async () => {
      authorized = true;
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: {
      listPublishedContentOptions: async () => [option()],
      listHomeCurationRows: async () => [],
      replaceHomeCuration: async () => {},
    },
  });

  await assert.rejects(
    service.saveHomeCuration({
      selections: [
        { slot: "currentlyGrowing", contentId: contentIdA, order: 0 },
        { slot: "recentlyPlanted", contentId: contentIdA, order: 0 },
      ],
    }),
    HomeCurationInputError,
  );
  assert.equal(authorized, false);
});

test("home curation service only saves Published content", async () => {
  const service = createHomeCurationManagementService({
    authorize: async () => ({
      id: "00000000-0000-4000-8000-00000000aa21",
    }),
    repository: {
      listPublishedContentOptions: async () => [option({ contentId: contentIdB })],
      listHomeCurationRows: async () => [],
      replaceHomeCuration: async () => {
        throw new Error("replaceHomeCuration was not expected");
      },
    },
  });

  await assert.rejects(
    service.saveHomeCuration({
      selections: [{ slot: "currentlyGrowing", contentId: contentIdA, order: 0 }],
    }),
    HomeCurationInputError,
  );
});

test("home curation repository reads Published options and replaces rows", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      if (table === "contents") {
        return {
          select(columns) {
            calls.push(["select", columns]);
            return {
              eq(column, value) {
                calls.push(["eq", column, value]);
                const query = {
                  order(orderColumn, options) {
                    calls.push(["order", orderColumn, options]);
                    if (orderColumn === "title_en") {
                      return Promise.resolve({
                        data: [
                          {
                            id: contentIdA,
                            title_zh: null,
                            title_en: "A Published Path",
                            region: "Garden",
                            growth_stage: "Growing",
                            updated_at: updatedAt,
                          },
                        ],
                        error: null,
                      });
                    }
                    return query;
                  },
                };
                return query;
              },
            };
          },
        };
      }
      if (table === "home_curation") {
        return {
          select(columns) {
            calls.push(["select", columns]);
            const query = {
              order(column, options) {
                calls.push(["order", column, options]);
                if (column === "sort_order") {
                  return Promise.resolve({
                    data: [
                      {
                        content_id: contentIdA,
                        slot: "currentlyGrowing",
                        sort_order: 0,
                        created_at: updatedAt,
                        updated_at: updatedAt,
                      },
                    ],
                    error: null,
                  });
                }
                return query;
              },
            };
            return query;
          },
          delete() {
            calls.push(["delete"]);
            return {
              in(column, values) {
                calls.push(["delete-in", column, values]);
                return Promise.resolve({ error: null });
              },
            };
          },
          insert(rows) {
            calls.push(["insert", rows]);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const repository = createHomeCurationRepository(client);
  assert.equal((await repository.listPublishedContentOptions())[0].title, "A Published Path");
  assert.equal((await repository.listHomeCurationRows())[0].slot, "currentlyGrowing");
  await repository.replaceHomeCuration([
    { slot: "currentlyGrowing", contentId: contentIdA, order: 0 },
  ]);

  assert.ok(
    calls.some(
      (call) =>
        Array.isArray(call) &&
        call[0] === "delete-in" &&
        call[1] === "slot" &&
        call[2][0] === "currentlyGrowing" &&
        call[2][1] === "recentlyPlanted",
    ),
  );
  assert.deepEqual(calls.at(-1), [
    "insert",
    [
      {
        content_id: contentIdA,
        slot: "currentlyGrowing",
        sort_order: 0,
      },
    ],
  ]);
});

test("home curation actions map save to safe states and revalidate routes", async () => {
  revalidatedPaths.length = 0;
  const actions = require(actionsPath);
  const result = await actions.saveHomeCurationAction(
    { status: "idle", message: null },
    form({
      currentlyGrowing: [contentIdA, ""],
      recentlyPlanted: [contentIdB],
    }),
  );

  assert.equal(result.status, "success");
  assert.deepEqual(revalidatedPaths, ["/", "/admin", "/admin/home"]);
});

test("home curation route follows protected admin patterns", () => {
  const page = fs.readFileSync(pagePath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");
  const contracts = fs.readFileSync(actionContractsPath, "utf8");
  const formSource = fs.readFileSync(formPath, "utf8");
  const layout = fs.readFileSync(layoutPath, "utf8");
  const adminIndex = fs.readFileSync(adminIndexPath, "utf8");

  assert.match(layout, /await requireGardenKeeper\(\)/);
  assert.match(layout, /href="\/admin\/home"/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(page, /await getHomeCurationWorkspace\(\)/);
  assert.doesNotMatch(page, /supabase|\.from\(|\.rpc\(/i);
  assert.match(formSource, /["']use client["']/);
  assert.match(formSource, /useActionState/);
  assert.match(formSource, /Currently Growing/);
  assert.match(formSource, /Recently Planted/);
  assert.match(formSource, /Add Selection/);
  assert.match(formSource, /Remove/);
  assert.match(actions, /["']use server["']/);
  assert.match(actions, /revalidatePath\("\/"\)/);
  assert.match(actions, /revalidatePath\("\/admin"\)/);
  assert.match(actions, /revalidatePath\("\/admin\/home"\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(contracts, /INITIAL_HOME_CURATION_ACTION_STATE/);
  assert.match(adminIndex, /home-curation-service/);
  assert.match(adminIndex, /home-curation-repository/);
});
