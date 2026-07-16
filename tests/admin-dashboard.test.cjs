/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const dashboardServicePath = path.join(
  projectRoot,
  "lib/content/admin/dashboard-service.ts",
);
const dashboardPagePath = path.join(
  projectRoot,
  "app/admin/(protected)/page.tsx",
);
const protectedLayoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
const adminLayoutPath = path.join(projectRoot, "app/admin/layout.tsx");
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

Module._load = function loadWithDashboardMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000004a21",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the dashboard repository.");
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
  DashboardServiceUnavailableError,
  createAdminDashboardService,
  mapDashboardSummary,
} = require(dashboardServicePath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

test("maps projection and active-revision lifecycle into one summary", () => {
  const summary = mapDashboardSummary([
    { projectionLifecycle: "Draft", activeRevisionLifecycle: "Draft" },
    { projectionLifecycle: "Draft", activeRevisionLifecycle: "Review" },
    { projectionLifecycle: "Published", activeRevisionLifecycle: "Review" },
    { projectionLifecycle: "Published", activeRevisionLifecycle: null },
    { projectionLifecycle: "Archived", activeRevisionLifecycle: null },
  ]);

  assert.deepEqual(summary, {
    totalContent: 5,
    lifecycleCounts: {
      Draft: 1,
      Review: 1,
      Published: 2,
      Archived: 1,
    },
  });
});

test("loads the dashboard summary only after the authorized boundary", async () => {
  const calls = [];
  const service = createAdminDashboardService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-000000004a21" };
    },
    repository: {
      listLifecycleRecords: async () => {
        calls.push("read");
        return [
          {
            projectionLifecycle: "Published",
            activeRevisionLifecycle: null,
          },
        ];
      },
    },
  });

  assert.deepEqual(await service.getDashboardSummary(), {
    totalContent: 1,
    lifecycleCounts: {
      Draft: 0,
      Review: 0,
      Published: 1,
      Archived: 0,
    },
  });
  assert.deepEqual(calls, ["authorize", "read"]);
});

test("blocks unauthorized dashboard reads before repository access", async () => {
  const denied = new Error("authentication_required");
  let repositoryCalls = 0;
  const service = createAdminDashboardService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listLifecycleRecords: async () => {
        repositoryCalls += 1;
        return [];
      },
    },
  });

  await assert.rejects(service.getDashboardSummary(), (error) => error === denied);
  assert.equal(repositoryCalls, 0);
});

test("returns a typed empty dashboard summary", async () => {
  const service = createAdminDashboardService({
    authorize: async () => ({
      id: "00000000-0000-4000-8000-000000004a21",
    }),
    repository: { listLifecycleRecords: async () => [] },
  });

  assert.deepEqual(await service.getDashboardSummary(), {
    totalContent: 0,
    lifecycleCounts: {
      Draft: 0,
      Review: 0,
      Published: 0,
      Archived: 0,
    },
  });
});

test("sanitizes dashboard repository failures", async () => {
  const service = createAdminDashboardService({
    authorize: async () => ({
      id: "00000000-0000-4000-8000-000000004a21",
    }),
    repository: {
      listLifecycleRecords: async () => {
        throw new Error("private public.contents SQL detail");
      },
    },
  });

  await assert.rejects(service.getDashboardSummary(), (error) => {
    assert.ok(error instanceof DashboardServiceUnavailableError);
    assert.doesNotMatch(error.message, /private|public\.|sql/i);
    return true;
  });
});

test("protected dashboard keeps noindex, server fetching, and typed empty states", () => {
  const page = fs.readFileSync(dashboardPagePath, "utf8");
  const protectedLayout = fs.readFileSync(protectedLayoutPath, "utf8");
  const adminLayout = fs.readFileSync(adminLayoutPath, "utf8");

  assert.match(protectedLayout, /await requireGardenKeeper\(\)/);
  assert.ok(
    protectedLayout.indexOf("await requireGardenKeeper()") <
      protectedLayout.indexOf("{children}"),
  );
  assert.match(adminLayout, /index:\s*false/);
  assert.match(adminLayout, /follow:\s*false/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.doesNotMatch(page, /supabase|\.from\(/i);
  assert.match(page, /await getDashboardSummary\(\)/);
  assert.match(page, /Nothing has been planted here yet\./);
  assert.match(page, /No activity has been recorded\./);
  assert.match(page, /Create Content/);
  assert.match(page, /Review Queue/);
  assert.match(page, /Media/);
  assert.match(page, /href:\s*"\/admin\/content\/new"/);
  assert.match(page, /href=\{action\.href\}/);
  assert.doesNotMatch(page, /<button/i);
});
