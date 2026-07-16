/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const mediaServicePath = path.join(
  projectRoot,
  "lib/content/admin/media-service.ts",
);
const mediaRepositoryPath = path.join(
  projectRoot,
  "lib/content/admin/media-repository.ts",
);
const mediaValidationPath = path.join(
  projectRoot,
  "lib/content/admin/media-validation.ts",
);
const mediaRoutePath = path.join(
  projectRoot,
  "app/admin/(protected)/media/page.tsx",
);
const mediaClientPath = path.join(
  projectRoot,
  "app/admin/(protected)/media/media-workspace.tsx",
);
const protectedLayoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260717090000_phase_05e_media_workspace.sql",
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

Module._load = function loadWithMediaMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000005e01",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the media repository.");
      },
    };
  }
  if (
    request === "./service" &&
    parent?.filename === mediaServicePath
  ) {
    return {
      createAdminContentService: () => {
        throw new Error("Tests must inject the Draft service.");
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
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  MediaReferenceUpdateError,
  createMediaWorkspaceService,
  mapMediaReferenceStatus,
} = require(mediaServicePath);
const {
  createMediaRepository,
} = require(mediaRepositoryPath);
const {
  MediaValidationError,
} = require(mediaValidationPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const contentId = "00000000-0000-4000-8000-000000005e11";
const revisionId = "00000000-0000-4000-8000-000000005e12";

function draftRevision(overrides = {}) {
  return {
    contentId,
    revisionId,
    lifecycle: "Draft",
    lockVersion: 4,
    sourceVersionId: null,
    baseContentUpdatedAt: null,
    reviewSubmittedAt: null,
    returnedToDraftAt: null,
    slug: "media-draft",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "short",
    growthStage: "Seed",
    titleZh: null,
    titleEn: "Media Draft",
    summaryZh: null,
    summaryEn: null,
    bodyZhMarkdown: null,
    bodyEnMarkdown: null,
    contentLanguage: "en",
    primaryCategories: [],
    tags: [],
    cover: {
      path: `contents/${contentId}/old-cover.jpg`,
      altZh: null,
      altEn: "Old cover description",
    },
    featured: false,
    manualOrder: null,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function fakeFile(overrides = {}) {
  return {
    name: "cover.webp",
    type: "image/webp",
    size: 1024,
    ...overrides,
  };
}

function repository(overrides = {}) {
  return {
    listMediaObjects: async () => [],
    uploadCover: async () => {},
    ...overrides,
  };
}

function draftService(overrides = {}) {
  const draft = draftRevision();
  return {
    getDraftById: async () => draft,
    listDrafts: async () => [draft],
    updateDraft: async ({ changes }) =>
      draftRevision({
        lockVersion: 5,
        updatedAt: "2026-07-17T02:00:00.000Z",
        cover: changes.cover,
      }),
    ...overrides,
  };
}

test("blocks unauthorized media access before reads or uploads", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  let draftCalls = 0;
  const service = createMediaWorkspaceService({
    authorize: async () => {
      throw denied;
    },
    repository: repository({
      listMediaObjects: async () => {
        repositoryCalls += 1;
        return [];
      },
      uploadCover: async () => {
        repositoryCalls += 1;
      },
    }),
    draftService: draftService({
      listDrafts: async () => {
        draftCalls += 1;
        return [];
      },
    }),
  });

  await assert.rejects(service.getWorkspace(), (error) => error === denied);
  await assert.rejects(
    service.replaceDraftCover({
      contentId,
      revisionId,
      expectedLockVersion: 4,
      file: fakeFile(),
    }),
    (error) => error === denied,
  );
  assert.equal(repositoryCalls, 0);
  assert.equal(draftCalls, 0);
});

test("rejects invalid file metadata before the upload boundary", async () => {
  let uploadCalls = 0;
  const service = createMediaWorkspaceService({
    authorize: async () => ({ id: "keeper" }),
    repository: repository({
      uploadCover: async () => {
        uploadCalls += 1;
      },
    }),
    draftService: draftService(),
  });

  await assert.rejects(
    service.replaceDraftCover({
      contentId,
      revisionId,
      expectedLockVersion: 4,
      file: fakeFile({ name: "cover.gif", type: "image/gif" }),
    }),
    (error) => {
      assert.ok(error instanceof MediaValidationError);
      assert.equal(error.code, "unsupported_file_type");
      return true;
    },
  );
  assert.equal(uploadCalls, 0);
});

test("rejects covers larger than the server size limit", async () => {
  let uploadCalls = 0;
  const service = createMediaWorkspaceService({
    authorize: async () => ({ id: "keeper" }),
    repository: repository({
      uploadCover: async () => {
        uploadCalls += 1;
      },
    }),
    draftService: draftService(),
  });

  await assert.rejects(
    service.replaceDraftCover({
      contentId,
      revisionId,
      expectedLockVersion: 4,
      file: fakeFile({ size: 5 * 1024 * 1024 + 1 }),
    }),
    (error) => {
      assert.ok(error instanceof MediaValidationError);
      assert.equal(error.code, "file_too_large");
      return true;
    },
  );
  assert.equal(uploadCalls, 0);
});

test("uses the server upload boundary and attaches a new immutable path", async () => {
  const calls = [];
  const service = createMediaWorkspaceService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "keeper" };
    },
    repository: repository({
      uploadCover: async (input) => calls.push(["upload", input]),
    }),
    draftService: draftService({
      getDraftById: async () => {
        calls.push("read-draft");
        return draftRevision();
      },
      updateDraft: async (input) => {
        calls.push(["update-reference", input]);
        return draftRevision({
          lockVersion: 5,
          cover: input.changes.cover,
          updatedAt: "2026-07-17T02:00:00.000Z",
        });
      },
    }),
    createObjectId: () => "00000000-0000-4000-8000-000000005eff",
  });
  const file = fakeFile();

  const receipt = await service.replaceDraftCover({
    contentId,
    revisionId,
    expectedLockVersion: 4,
    file,
  });

  const newPath =
    `contents/${contentId}/00000000-0000-4000-8000-000000005eff.webp`;
  assert.equal(receipt.objectPath, newPath);
  assert.equal(receipt.lockVersion, 5);
  assert.equal(calls[0], "authorize");
  assert.equal(calls[1], "read-draft");
  assert.deepEqual(calls[2], [
    "upload",
    { objectPath: newPath, file, contentType: "image/webp" },
  ]);
  assert.equal(calls[3][0], "update-reference");
});

test("preserves the old reference path and existing alt metadata on replacement", async () => {
  let updateInput;
  const current = draftRevision();
  const service = createMediaWorkspaceService({
    authorize: async () => ({ id: "keeper" }),
    repository: repository(),
    draftService: draftService({
      getDraftById: async () => current,
      updateDraft: async (input) => {
        updateInput = input;
        return draftRevision({
          lockVersion: 5,
          cover: input.changes.cover,
        });
      },
    }),
    createObjectId: () => "00000000-0000-4000-8000-000000005efe",
  });

  const receipt = await service.replaceDraftCover({
    contentId,
    revisionId,
    expectedLockVersion: 4,
    file: fakeFile(),
  });

  assert.equal(receipt.previousObjectPath, current.cover.path);
  assert.notEqual(receipt.objectPath, current.cover.path);
  assert.equal(updateInput.changes.cover.altEn, "Old cover description");
  assert.equal(updateInput.changes.cover.altZh, null);
});

test("reference failure keeps the uploaded object and exposes no delete operation", async () => {
  const calls = [];
  const mediaRepository = repository({
    uploadCover: async ({ objectPath }) => calls.push(["upload", objectPath]),
  });
  const service = createMediaWorkspaceService({
    authorize: async () => ({ id: "keeper" }),
    repository: mediaRepository,
    draftService: draftService({
      updateDraft: async () => {
        calls.push(["reference-failed"]);
        throw new Error("conflict");
      },
    }),
    createObjectId: () => "00000000-0000-4000-8000-000000005efd",
  });

  await assert.rejects(
    service.replaceDraftCover({
      contentId,
      revisionId,
      expectedLockVersion: 4,
      file: fakeFile(),
    }),
    MediaReferenceUpdateError,
  );
  assert.deepEqual(calls.map(([name]) => name), ["upload", "reference-failed"]);
  assert.equal("deleteObject" in mediaRepository, false);
  assert.equal("remove" in mediaRepository, false);
});

test("maps referenced, unreferenced, and quarantine awareness states", () => {
  assert.equal(
    mapMediaReferenceStatus({ lifecycleState: "Referenced", referenceCount: 2 }),
    "Referenced",
  );
  assert.equal(
    mapMediaReferenceStatus({ lifecycleState: "Unreferenced", referenceCount: 0 }),
    "Unreferenced",
  );
  assert.equal(
    mapMediaReferenceStatus({ lifecycleState: "Quarantine", referenceCount: 0 }),
    "QuarantineCandidate",
  );
  assert.equal(
    mapMediaReferenceStatus({
      lifecycleState: "EligibleForPurge",
      referenceCount: 0,
    }),
    "QuarantineCandidate",
  );
  assert.equal(
    mapMediaReferenceStatus({ lifecycleState: "Quarantine", referenceCount: 1 }),
    "Referenced",
  );
});

test("media repository uses the allow-listed read RPC and private cover bucket", async () => {
  const calls = [];
  const client = {
    rpc: async (name) => {
      calls.push(["rpc", name]);
      return { data: [], error: null };
    },
    storage: {
      from: (bucket) => ({
        upload: async (objectPath, file, options) => {
          calls.push(["upload", bucket, objectPath, file, options]);
          return { data: { path: objectPath }, error: null };
        },
      }),
    },
  };
  const mediaRepository = createMediaRepository(client);
  const file = fakeFile();

  await mediaRepository.listMediaObjects();
  await mediaRepository.uploadCover({
    objectPath: `contents/${contentId}/cover.webp`,
    file,
    contentType: "image/webp",
  });

  assert.deepEqual(calls[0], ["rpc", "list_keeper_media_workspace"]);
  assert.deepEqual(calls[1].slice(0, 4), [
    "upload",
    "cover-images",
    `contents/${contentId}/cover.webp`,
    file,
  ]);
  assert.equal(calls[1][4].upsert, false);
});

test("route, UI, and SQL keep the workspace Keeper-only and deletion-free", () => {
  const route = fs.readFileSync(mediaRoutePath, "utf8");
  const client = fs.readFileSync(mediaClientPath, "utf8");
  const layout = fs.readFileSync(protectedLayoutPath, "utf8");
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(layout, /requireGardenKeeper/);
  assert.match(layout, /href="\/admin\/media"/);
  assert.match(route, /createMediaWorkspaceService\(\)\.getWorkspace\(\)/);
  assert.match(client, /Quarantine labels are awareness only/);
  assert.match(migration, /if not private\.is_garden_keeper\(\)/i);
  assert.match(migration, /revoke all[\s\S]*?from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /(?:create|drop|alter)\s+policy/i);
  assert.doesNotMatch(migration, /delete\s+from\s+storage\.objects/i);
  assert.doesNotMatch(migration, /service_role/i);
});
