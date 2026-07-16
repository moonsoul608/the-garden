/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const authorizationPath = path.join(
  projectRoot,
  "lib/auth/authorization.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/redirects/repository.ts",
);
const servicePath = path.join(
  projectRoot,
  "lib/content/redirects/service.ts",
);
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260716050000_phase_04d_redirect_contract_hardening.sql",
);
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

let authExports;

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

Module._load = function loadWithRedirectMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth" && authExports) return authExports;
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("A redirect test must inject its repository.");
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

authExports = require(authorizationPath);

const { GardenKeeperRequiredError } = authExports;
const { createRedirectRepository } = require(repositoryPath);
const { createRedirectService } = require(servicePath);

const keeper = { id: "00000000-0000-4000-8000-000000004c31" };
const createdAt = "2026-07-16T09:00:00.000Z";

function command(overrides = {}) {
  return {
    sourceRoute: "/garden/old-path",
    targetRoute: "/garden/new-path",
    type: "slug_migration",
    reason: "Canonical slug correction",
    ...overrides,
  };
}

function redirectRecord(overrides = {}) {
  return {
    redirectId: "00000000-0000-4000-8000-000000004d31",
    sourceRoute: "/garden/old-path",
    targetRoute: "/garden/new-path",
    statusCode: 308,
    type: "slug_migration",
    reason: "Canonical slug correction",
    createdBy: keeper.id,
    createdAt,
    ...overrides,
  };
}

function rpcRepository(results, calls = []) {
  const queue = [...results];
  return createRedirectRepository({
    rpc: async (name, args) => {
      calls.push({ name, args });
      const result = queue.shift();
      if (!result) throw new Error("Missing mocked redirect RPC result");
      return result;
    },
  });
}

function serviceForResults(results, calls = []) {
  return createRedirectService({
    authorize: async () => keeper,
    repository: rpcRepository(results, calls),
  });
}

function databaseFailure(message, code = "22023") {
  return { data: null, error: { code, message } };
}

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

test("creates a valid typed 308 redirect through the repository boundary", async () => {
  const calls = [];
  const expected = redirectRecord();
  const service = serviceForResults([{ data: expected, error: null }], calls);

  assert.deepEqual(await service.createRedirect(command()), expected);
  assert.deepEqual(calls, [
    {
      name: "create_route_redirect",
      args: {
        p_source_route: "/garden/old-path",
        p_target_route: "/garden/new-path",
        p_redirect_type: "slug_migration",
        p_reason: "Canonical slug correction",
      },
    },
  ]);
});

test("rejects a self redirect before repository access", async () => {
  let repositoryCalls = 0;
  const service = createRedirectService({
    authorize: async () => keeper,
    repository: {
      createRedirect: async () => {
        repositoryCalls += 1;
        return redirectRecord();
      },
    },
  });

  await assert.rejects(
    service.createRedirect(
      command({ targetRoute: "/garden/old-path" }),
    ),
    (error) => error.code === "self_redirect",
  );
  assert.equal(repositoryCalls, 0);
});

for (const [name, message, code] of [
  ["loop", "redirect_loop", "40001"],
  ["chain", "redirect_chain", "40001"],
  ["Draft target", "redirect_target_draft", "22023"],
  ["Review target", "redirect_target_review", "22023"],
  ["deleted target", "redirect_target_deleted", "22023"],
  ["missing source", "redirect_source_not_reserved", "P0002"],
  ["missing target", "redirect_target_not_found", "P0002"],
]) {
  test(`returns a typed rejection for a ${name}`, async () => {
    const service = serviceForResults([databaseFailure(message, code)]);
    await assert.rejects(
      service.createRedirect(command()),
      (error) => error.code === message,
    );
  });
}

test("returns the existing redirect for an identical duplicate command", async () => {
  const existing = redirectRecord();
  const service = serviceForResults([
    { data: existing, error: null },
    { data: existing, error: null },
  ]);

  const first = await service.createRedirect(command());
  const retry = await service.createRedirect(command());
  assert.deepEqual(retry, first);
});

test("returns a typed conflict instead of overwriting another target", async () => {
  const service = serviceForResults([
    databaseFailure("redirect_conflict", "23505"),
  ]);

  await assert.rejects(
    service.createRedirect(command({ targetRoute: "/forest/other-path" })),
    (error) => error.code === "redirect_conflict",
  );
});

test("requires Keeper authorization before redirect repository access", async () => {
  let repositoryCalls = 0;
  const service = createRedirectService({
    authorize: async () => {
      throw new GardenKeeperRequiredError();
    },
    repository: {
      createRedirect: async () => {
        repositoryCalls += 1;
        return redirectRecord();
      },
    },
  });

  await assert.rejects(
    service.createRedirect(command()),
    GardenKeeperRequiredError,
  );
  assert.equal(repositoryCalls, 0);
});

test("rejects external, utility, and malformed routes before repository access", async () => {
  const service = createRedirectService({
    authorize: async () => keeper,
    repository: {
      createRedirect: async () => redirectRecord(),
    },
  });

  for (const [input, expectedCode] of [
    [command({ sourceRoute: "https://example.com/old" }), "invalid_source_route"],
    [command({ targetRoute: "/search" }), "invalid_target_route"],
    [command({ targetRoute: "/garden/Bad-Slug" }), "invalid_target_route"],
  ]) {
    await assert.rejects(
      service.createRedirect(input),
      (error) => error.code === expectedCode,
    );
  }
});

test("migration enforces the atomic one-hop Keeper command and direct-write denial", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(migration, /create function public\.create_route_redirect\s*\(/i);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog/i);
  assert.match(migration, /if p_source_route = p_target_route then[\s\S]*self_redirect/i);
  assert.match(migration, /target_route_record\.new_path = p_source_route[\s\S]*redirect_loop/i);
  assert.match(migration, /redirect\.new_path = p_source_route[\s\S]*redirect_chain/i);
  assert.match(migration, /target_content\.lifecycle = 'Draft'[\s\S]*redirect_target_draft/i);
  assert.match(migration, /target_content\.lifecycle = 'Review'[\s\S]*redirect_target_review/i);
  assert.match(migration, /target_route_record\.status_code = 410[\s\S]*redirect_target_deleted/i);
  assert.match(migration, /existing_redirect\.reason is not distinct from p_reason/i);
  assert.match(migration, /raise unique_violation using message = 'redirect_conflict'/i);
  assert.match(migration, /grant execute on function public\.create_route_redirect[\s\S]*to authenticated/i);
  assert.match(migration, /revoke insert, update, delete on table public\.route_redirects[\s\S]*from authenticated/i);
  assert.doesNotMatch(migration, /grant\s+select[\s\S]*route_redirects[\s\S]*to\s+anon/i);
  assert.doesNotMatch(migration, /disable row level security/i);
});
