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
const servicePath = path.join(projectRoot, "lib/content/admin/service.ts");
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/repository.ts",
);
const contentErrorsPath = path.join(projectRoot, "lib/content/errors.ts");
const mutationErrorsPath = path.join(
  projectRoot,
  "lib/content/admin/errors.ts",
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

Module._load = function loadWithFoundationMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth" && authExports) return authExports;
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

authExports = require(authorizationPath);

const {
  AuthenticationRequiredError,
  GardenKeeperRequiredError,
} = authExports;
const { ContentValidationError } = require(contentErrorsPath);
const { ContentMutationError } = require(mutationErrorsPath);
const { createAdminContentService } = require(servicePath);
const { createContentWriteRepository } = require(repositoryPath);

const keeper = { id: "00000000-0000-4000-8000-000000004c01" };

function validDraftInput() {
  return {
    slug: "  First-Draft  ",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "short",
    growthStage: "Seed",
    titleZh: null,
    titleEn: "  First draft  ",
    contentLanguage: "en",
    tags: [" AI ", "ai", "Notes"],
  };
}

function repositoryStub(overrides = {}) {
  return {
    createDraft: async () => {
      throw new Error("Unexpected createDraft call");
    },
    getContentWorkflowState: async () => null,
    getDraftRevision: async () => null,
    updateDraft: async () => {
      throw new Error("Unexpected updateDraft call");
    },
    startDraftRevision: async () => {
      throw new Error("Unexpected startDraftRevision call");
    },
    ...overrides,
  };
}

function mutationAttempts(service) {
  return [
    () => service.createDraft(validDraftInput()),
    () =>
      service.updateDraft({
        contentId: "content-id",
        revisionId: "revision-id",
        expectedLockVersion: 1,
        changes: { titleEn: "Changed" },
      }),
    () => service.startDraftRevision({ contentId: "content-id" }),
  ];
}

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

test("denies an unauthenticated mutation before repository access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => {
      throw new AuthenticationRequiredError();
    },
    repository: repositoryStub({
      createDraft: async () => {
        repositoryCalls += 1;
      },
      getDraftRevision: async () => {
        repositoryCalls += 1;
      },
      getContentWorkflowState: async () => {
        repositoryCalls += 1;
      },
    }),
  });

  for (const attempt of mutationAttempts(service)) {
    await assert.rejects(attempt(), AuthenticationRequiredError);
  }
  assert.equal(repositoryCalls, 0);
});

test("denies a non-Keeper mutation before repository access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => {
      throw new GardenKeeperRequiredError();
    },
    repository: repositoryStub({
      createDraft: async () => {
        repositoryCalls += 1;
      },
      getDraftRevision: async () => {
        repositoryCalls += 1;
      },
      getContentWorkflowState: async () => {
        repositoryCalls += 1;
      },
    }),
  });

  for (const attempt of mutationAttempts(service)) {
    await assert.rejects(attempt(), GardenKeeperRequiredError);
  }
  assert.equal(repositoryCalls, 0);
});

test("returns typed domain validation failures without writing", async () => {
  let repositoryCalled = false;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      createDraft: async () => {
        repositoryCalled = true;
      },
    }),
  });

  await assert.rejects(
    service.createDraft({
      ...validDraftInput(),
      titleEn: "   ",
    }),
    (error) => {
      assert.ok(error instanceof ContentValidationError);
      assert.deepEqual(
        error.issues.map((issue) => issue.code),
        ["missing_title"],
      );
      return true;
    },
  );
  assert.equal(repositoryCalled, false);
});

test("returns a typed invalid-slug failure before writing", async () => {
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub(),
  });

  await assert.rejects(
    service.createDraft({
      ...validDraftInput(),
      slug: "not_a_slug",
    }),
    (error) => {
      assert.ok(error instanceof ContentValidationError);
      assert.equal(error.issues[0].code, "invalid_slug");
      return true;
    },
  );
});

test("normalizes Draft data before the repository mutation", async () => {
  let received;
  const expected = { revisionId: "revision-result" };
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      createDraft: async (fields) => {
        received = fields;
        return expected;
      },
    }),
  });

  assert.equal(await service.createDraft(validDraftInput()), expected);
  assert.equal(received.slug, "first-draft");
  assert.equal(received.titleEn, "First draft");
  assert.deepEqual(received.tags, ["ai", "Notes"]);
  assert.equal("createdBy" in received, false);
  assert.equal("updatedAt" in received, false);
});

test("maps repository database errors to safe typed mutation errors", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key exposes private constraint detail",
      },
    }),
  };
  const repository = createContentWriteRepository(client);

  await assert.rejects(
    repository.createDraft({
      slug: "first-draft",
      region: "Garden",
      contentType: "Seed",
      detailLevel: "short",
      growthStage: "Seed",
      titleZh: null,
      titleEn: "First draft",
      summaryZh: null,
      summaryEn: null,
      bodyZhMarkdown: null,
      bodyEnMarkdown: null,
      contentLanguage: "en",
      primaryCategories: [],
      tags: [],
      cover: null,
      featured: false,
      manualOrder: null,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "slug_conflict");
      assert.equal(error.operation, "createDraft");
      assert.doesNotMatch(error.message, /private|constraint|duplicate key/i);
      return true;
    },
  );
});
