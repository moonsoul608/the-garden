/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const authorizationPath = path.join(projectRoot, "lib/auth/authorization.ts");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

let clients = [];

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

Module._load = function loadWithAuthorizationMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        const client = clients.shift();
        if (!client) throw new Error("Missing mocked Supabase client");
        return client;
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
  AuthenticationRequiredError,
  AuthorizationUnavailableError,
  GardenKeeperRequiredError,
  requireAuthenticatedUser,
  requireGardenKeeper,
} = require(authorizationPath);

const userId = "00000000-0000-4000-8000-000000004a21";

function claimsClient(claims) {
  return {
    auth: {
      getClaims: async () => ({ data: { claims }, error: null }),
    },
  };
}

function keeperStatusClient(data, error = null) {
  return {
    rpc: async (name) => {
      assert.equal(name, "current_user_is_garden_keeper");
      return { data, error };
    },
  };
}

test.beforeEach(() => {
  clients = [];
});

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

test("denies an unauthenticated visitor with a controlled error", async () => {
  clients.push(claimsClient({}));

  await assert.rejects(requireGardenKeeper(), (error) => {
    assert.ok(error instanceof AuthenticationRequiredError);
    assert.equal(error.code, "authentication_required");
    assert.equal(error.status, 401);
    return true;
  });
  assert.equal(clients.length, 0);
});

test("denies an authenticated non-Keeper without exposing allow-list data", async () => {
  clients.push(
    claimsClient({ sub: userId, is_anonymous: false }),
    keeperStatusClient(false),
  );

  await assert.rejects(requireGardenKeeper(), (error) => {
    assert.ok(error instanceof GardenKeeperRequiredError);
    assert.equal(error.code, "garden_keeper_required");
    assert.equal(error.status, 403);
    assert.doesNotMatch(error.message, /github|provider|username|email|allow-list/i);
    return true;
  });
});

test("allows an approved Keeper and returns only the verified user id", async () => {
  clients.push(
    claimsClient({
      sub: userId,
      is_anonymous: false,
      email: "untrusted@example.invalid",
      user_metadata: { user_name: "mutable-name" },
    }),
    keeperStatusClient(true),
  );

  assert.deepEqual(await requireGardenKeeper(), { id: userId });
});

test("denies an invalid provider identity even when mutable metadata looks approved", async () => {
  clients.push(
    claimsClient({
      sub: userId,
      is_anonymous: false,
      email: "keeper@example.invalid",
      user_metadata: { user_name: "approved-keeper" },
    }),
    keeperStatusClient(false),
  );

  await assert.rejects(requireGardenKeeper(), GardenKeeperRequiredError);
});

test("requireAuthenticatedUser returns safe identity information only", async () => {
  clients.push(
    claimsClient({
      sub: userId,
      email: "not-returned@example.invalid",
      user_metadata: { user_name: "not-returned" },
    }),
  );

  assert.deepEqual(await requireAuthenticatedUser(), { id: userId });
});

test("fails closed with a controlled error when the Keeper RPC is unavailable", async () => {
  clients.push(
    claimsClient({ sub: userId }),
    keeperStatusClient(null, { message: "private database detail" }),
  );

  await assert.rejects(requireGardenKeeper(), (error) => {
    assert.ok(error instanceof AuthorizationUnavailableError);
    assert.equal(error.code, "authorization_unavailable");
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /private database detail/);
    return true;
  });
});
