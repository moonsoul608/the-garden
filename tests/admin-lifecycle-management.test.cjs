/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const lifecycleServicePath = path.join(
  projectRoot,
  "lib/content/admin/lifecycle-management-service.ts",
);
const handlersPath = path.join(
  projectRoot,
  "app/admin/(protected)/lifecycle/action-handlers.ts",
);
const pagePath = path.join(
  projectRoot,
  "app/admin/(protected)/lifecycle/page.tsx",
);
const panelPath = path.join(
  projectRoot,
  "app/admin/(protected)/lifecycle/lifecycle-actions.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/lifecycle/actions.ts",
);
const layoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
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

Module._load = function loadWithLifecycleMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000005d01",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the lifecycle repository.");
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
  createLifecycleManagementService,
  mapLifecycleListItem,
} = require(lifecycleServicePath);
const { createLifecycleActionHandlers } = require(handlersPath);
const { ContentMutationError } = require(path.join(
  projectRoot,
  "lib/content/admin/errors.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const contentId = "00000000-0000-4000-8000-000000005d11";
const sourceVersionId = "00000000-0000-4000-8000-000000005d12";
const relationId = "00000000-0000-4000-8000-000000005d13";
const relatedContentId = "00000000-0000-4000-8000-000000005d14";
const updatedAt = "2026-07-16T10:00:00.000Z";

function lifecycleRecord(overrides = {}) {
  return {
    contentId,
    slug: "a-maintained-path",
    region: "Garden",
    lifecycle: "Published",
    titleZh: null,
    titleEn: "A maintained path",
    updatedAt,
    publishedAt: "2026-07-16T09:00:00.000Z",
    archivedAt: null,
    activeRevision: null,
    sourceArchive: null,
    ...overrides,
  };
}

function commandContext(overrides = {}) {
  return {
    contentId,
    canonicalRoute: "/garden/a-maintained-path",
    lifecycle: "Published",
    updatedAt,
    sourceArchiveVersionId: null,
    workspaceState: null,
    ...overrides,
  };
}

function form(fields) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function idleState() {
  return { status: "idle", message: null, preview: null };
}

function mutationStubs(overrides = {}) {
  return {
    archiveContent: async () => {
      throw new Error("archiveContent was not expected");
    },
    restoreVersionToDraft: async () => {
      throw new Error("restoreVersionToDraft was not expected");
    },
    previewDeletionImpact: async () => {
      throw new Error("previewDeletionImpact was not expected");
    },
    deleteArchivedContent: async () => {
      throw new Error("deleteArchivedContent was not expected");
    },
    ...overrides,
  };
}

test("lifecycle reads authorize before repository access", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  const service = createLifecycleManagementService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listLifecycleRecords: async () => {
        repositoryCalls += 1;
        return [];
      },
      getLifecycleRecord: async () => {
        repositoryCalls += 1;
        return null;
      },
    },
  });

  await assert.rejects(
    service.listLifecycleOverview(),
    (error) => error === denied,
  );
  assert.equal(repositoryCalls, 0);
});

test("lifecycle list exposes public identity and maps the last action", () => {
  const item = mapLifecycleListItem(
    lifecycleRecord({
      lifecycle: "Archived",
      archivedAt: updatedAt,
      sourceArchive: { versionId: sourceVersionId, createdAt: updatedAt },
    }),
  );

  assert.equal(item.canonicalRoute, "/garden/a-maintained-path");
  assert.equal(item.lifecycle, "Archived");
  assert.equal(item.lastAction, "Archived");
  assert.equal(item.sourceArchiveAt, updatedAt);
  assert.doesNotMatch(JSON.stringify(item), new RegExp(contentId));
  assert.doesNotMatch(JSON.stringify(item), new RegExp(sourceVersionId));
});

test("archive confirmation resolves the public route and calls the archive service", async () => {
  let received;
  const handlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async (route) => {
        assert.equal(route, "/garden/a-maintained-path");
        return commandContext();
      },
    },
    mutations: mutationStubs({
      archiveContent: async (input) => {
        received = input;
        return {};
      },
    }),
    createOperationId: () => "00000000-0000-4000-8000-000000005d21",
  });

  const result = await handlers.archiveContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedUpdatedAt: updatedAt,
    }),
  );

  assert.equal(result.status, "success", JSON.stringify(result));
  assert.deepEqual(received, {
    contentId,
    expectedUpdatedAt: updatedAt,
    operationId: "00000000-0000-4000-8000-000000005d21",
  });
  assert.equal(received.actor, undefined);
});

test("restore keeps version identity server-side and preserves the archive token", async () => {
  let received;
  const handlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async () =>
        commandContext({
          lifecycle: "Archived",
          sourceArchiveVersionId: sourceVersionId,
        }),
    },
    mutations: mutationStubs({
      restoreVersionToDraft: async (input) => {
        received = input;
        return {};
      },
    }),
    createOperationId: () => "00000000-0000-4000-8000-000000005d22",
  });

  const result = await handlers.restoreContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedUpdatedAt: updatedAt,
    }),
  );

  assert.equal(result.status, "success");
  assert.deepEqual(received, {
    contentId,
    sourceVersionId,
    expectedArchivedToken: updatedAt,
    operationId: "00000000-0000-4000-8000-000000005d22",
  });
});

test("delete requires a safe impact preview and explicit destructive confirmation", async () => {
  let deleteCalls = 0;
  let deletionInput;
  const impactDigest = "0123456789abcdef0123456789abcdef";
  const handlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async () =>
        commandContext({
          lifecycle: "Archived",
          sourceArchiveVersionId: sourceVersionId,
        }),
    },
    mutations: mutationStubs({
      previewDeletionImpact: async () => {
        return {
        contentId,
        lifecycle: "Archived",
        expectedArchivedToken: updatedAt,
        canonicalRoute: "/garden/a-maintained-path",
        historicalRoutes: ["/forest/an-older-path"],
        redirectReferences: [
          {
            routePath: "/lake/a-retired-path",
            destinationPath: "/garden/a-maintained-path",
            statusCode: 308,
          },
        ],
        versionCount: 4,
        revisionStatus: {
          active: false,
          revisionId: null,
          lifecycle: null,
          lockVersion: null,
        },
        inboundRelations: [
          { relationId, relatedContentId, relationType: "relatedTo" },
        ],
        outboundRelations: [],
        storageReferenceCount: 2,
        affectedInvalidationSurfaces: ["route", "search"],
          impactDigest,
        };
      },
      deleteArchivedContent: async (input) => {
        deleteCalls += 1;
        deletionInput = input;
        return {};
      },
    }),
    createOperationId: () => "00000000-0000-4000-8000-000000005d23",
  });

  const preview = await handlers.previewDeletion(
    idleState(),
    form({ canonicalRoute: "/garden/a-maintained-path" }),
  );
  assert.equal(preview.status, "preview", JSON.stringify(preview));
  assert.deepEqual(preview.preview.affectedRoutes, [
    "/garden/a-maintained-path",
    "/forest/an-older-path",
    "/lake/a-retired-path",
  ]);
  assert.equal(preview.preview.inboundRelationCount, 1);
  assert.equal(preview.preview.versionCount, 4);
  assert.equal(preview.preview.storageReferenceCount, 2);
  assert.doesNotMatch(JSON.stringify(preview), new RegExp(relationId));
  assert.doesNotMatch(JSON.stringify(preview), new RegExp(relatedContentId));

  const unconfirmed = await handlers.deleteContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedArchivedToken: updatedAt,
      impactDigest,
      deleteConfirmation: "delete",
    }),
  );
  assert.equal(unconfirmed.status, "error");
  assert.equal(deleteCalls, 0);

  const confirmed = await handlers.deleteContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedArchivedToken: updatedAt,
      impactDigest,
      deleteConfirmation: "DELETE",
    }),
  );
  assert.equal(confirmed.status, "success");
  assert.equal(deleteCalls, 1);
  assert.deepEqual(deletionInput, {
    contentId,
    expectedArchivedToken: updatedAt,
    impactDigest,
    operationId: "00000000-0000-4000-8000-000000005d23",
  });
});

test("unsafe lifecycle transitions stop at the server boundary with safe errors", async () => {
  let archiveCalls = 0;
  const handlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async () =>
        commandContext({ lifecycle: "Archived" }),
    },
    mutations: mutationStubs({
      archiveContent: async () => {
        archiveCalls += 1;
      },
    }),
  });

  const wrongState = await handlers.archiveContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedUpdatedAt: updatedAt,
    }),
  );
  assert.equal(wrongState.status, "conflict");
  assert.equal(archiveCalls, 0);

  const privateFailureHandlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async () => commandContext(),
    },
    mutations: mutationStubs({
      archiveContent: async () => {
        throw new Error("private RPC and database details");
      },
    }),
  });
  const privateFailure = await privateFailureHandlers.archiveContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedUpdatedAt: updatedAt,
    }),
  );
  assert.equal(privateFailure.status, "error");
  assert.doesNotMatch(privateFailure.message, /private|rpc|database/i);

  const staleHandlers = createLifecycleActionHandlers({
    lifecycle: {
      getLifecycleCommandContext: async () => commandContext(),
    },
    mutations: mutationStubs({
      archiveContent: async () => {
        throw new ContentMutationError("archive_conflict", "archiveContent");
      },
    }),
  });
  const stale = await staleHandlers.archiveContent(
    idleState(),
    form({
      canonicalRoute: "/garden/a-maintained-path",
      expectedUpdatedAt: updatedAt,
    }),
  );
  assert.equal(stale.status, "conflict");
  assert.match(stale.message, /Reload/);
});

test("lifecycle route keeps authorization, data, and mutations on the server", () => {
  const layout = fs.readFileSync(layoutPath, "utf8");
  const page = fs.readFileSync(pagePath, "utf8");
  const panel = fs.readFileSync(panelPath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");

  assert.match(layout, /await requireGardenKeeper\(\)/);
  assert.match(layout, /href="\/admin\/lifecycle"/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(page, /await listLifecycleOverview\(\)/);
  assert.doesNotMatch(page, /supabase|\.from\(|\.rpc\(/i);
  assert.match(actions, /createAdminContentService\(\)/);
  assert.match(actions, /createLifecycleManagementService\(\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(panel, /name="deleteConfirmation"/);
  assert.match(panel, /Storage objects are NOT immediately deleted/);
  assert.match(panel, /Historical versions remain protected/);
  assert.doesNotMatch(panel, /contentId|sourceVersionId|relationId|supabase|rpc/i);
});
