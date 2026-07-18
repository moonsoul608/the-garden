/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const loginRoutePath = path.join(projectRoot, "app/auth/login/github/route.ts");
const protectedLayoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

let oauthResult;
let oauthCalls;

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

Module._load = function loadWithAuthEntryMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/server") {
    return {
      NextResponse: {
        redirect: (url, status) => ({ location: url.toString(), status }),
      },
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => ({
        auth: {
          signInWithOAuth: async (options) => {
            oauthCalls.push(options);
            return oauthResult;
          },
        },
      }),
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

const { GET } = require(loginRoutePath);

function request(url) {
  return { nextUrl: new URL(url) };
}

test.beforeEach(() => {
  oauthCalls = [];
  oauthResult = {
    data: { url: "https://github.com/login/oauth/authorize?client_id=test" },
    error: null,
  };
});

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

test("starts GitHub OAuth with the production-origin callback", async () => {
  const response = await GET(
    request("https://www.moonsoulgarden.site/auth/login/github?next=/admin"),
  );

  assert.deepEqual(oauthCalls, [
    {
      provider: "github",
      options: {
        redirectTo:
          "https://www.moonsoulgarden.site/auth/callback?next=%2Fadmin",
      },
    },
  ]);
  assert.deepEqual(response, {
    location: "https://github.com/login/oauth/authorize?client_id=test",
    status: 303,
  });
});

test("rejects an external post-login redirect", async () => {
  await GET(
    request(
      "https://www.moonsoulgarden.site/auth/login/github?next=https://evil.invalid",
    ),
  );

  assert.equal(
    oauthCalls[0].options.redirectTo,
    "https://www.moonsoulgarden.site/auth/callback?next=%2Fadmin",
  );
});

test("fails safely when the OAuth provider cannot be started", async () => {
  oauthResult = { data: { url: null }, error: { message: "provider error" } };

  const response = await GET(
    request("https://www.moonsoulgarden.site/auth/login/github?next=/admin"),
  );

  assert.deepEqual(response, {
    location:
      "https://www.moonsoulgarden.site/?auth_error=oauth_start_failed",
    status: 303,
  });
});

test("admin access keeps authentication and Keeper authorization distinct", () => {
  const source = fs.readFileSync(protectedLayoutPath, "utf8");

  assert.match(source, /await requireGardenKeeper\(\)/);
  assert.match(
    source,
    /error instanceof AuthenticationRequiredError[\s\S]*redirect\("\/auth\/login\/github\?next=\/admin"\)/,
  );
  assert.match(
    source,
    /error instanceof GardenKeeperRequiredError[\s\S]*forbidden\(\)/,
  );
  assert.doesNotMatch(source, /unauthorized\(\)/);
});
