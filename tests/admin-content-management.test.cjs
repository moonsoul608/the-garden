/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const managementServicePath = path.join(
  projectRoot,
  "lib/content/admin/content-management-service.ts",
);
const formHandlersPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/form-handlers.ts",
);
const contentPagePath = path.join(
  projectRoot,
  "app/admin/(protected)/content/page.tsx",
);
const contentLoadingPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/loading.tsx",
);
const contentErrorPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/error.tsx",
);
const contentActionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/actions.ts",
);
const contentFormPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/content-form.tsx",
);
const protectedLayoutPath = path.join(
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

Module._load = function loadWithContentManagementMocks(
  request,
  parent,
  isMain,
) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000005b01",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the content repository.");
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
  ContentManagementUnavailableError,
  createAdminContentManagementService,
  mapAdminContentListItem,
} = require(managementServicePath);
const { createContentFormHandlers } = require(formHandlersPath);
const { ContentValidationError } = require(path.join(
  projectRoot,
  "lib/content/errors.ts",
));
const { ContentMutationError } = require(path.join(
  projectRoot,
  "lib/content/admin/errors.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

function contentRecord(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000005b11",
    lifecycle: "Draft",
    titleZh: null,
    titleEn: "A quiet Draft",
    region: "Garden",
    growthStage: "Seed",
    updatedAt: "2026-07-16T08:00:00.000Z",
    activeRevision: {
      revisionId: "00000000-0000-4000-8000-000000005b12",
      lifecycle: "Draft",
      lockVersion: 3,
      titleZh: null,
      titleEn: "A quiet Draft",
      region: "Garden",
      growthStage: "Seed",
      updatedAt: "2026-07-16T09:00:00.000Z",
    },
    ...overrides,
  };
}

function draftRevision(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000005b11",
    revisionId: "00000000-0000-4000-8000-000000005b12",
    lifecycle: "Draft",
    lockVersion: 1,
    sourceVersionId: null,
    baseContentUpdatedAt: null,
    reviewSubmittedAt: null,
    returnedToDraftAt: null,
    slug: "a-quiet-draft",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "short",
    growthStage: "Seed",
    titleZh: null,
    titleEn: "A quiet Draft",
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
    createdAt: "2026-07-16T08:00:00.000Z",
    updatedAt: "2026-07-16T09:00:00.000Z",
    ...overrides,
  };
}

function validFormData() {
  const formData = new FormData();
  formData.set("slug", "  A-Quiet-Draft  ");
  formData.set("region", "Garden");
  formData.set("contentType", "Seed");
  formData.set("detailLevel", "short");
  formData.set("growthStage", "Seed");
  formData.set("titleEn", "  A quiet Draft  ");
  formData.set("titleZh", "");
  formData.set("summaryEn", "A small note.");
  formData.set("summaryZh", "");
  formData.set("bodyEnMarkdown", "Plain structured text.");
  formData.set("bodyZhMarkdown", "");
  formData.set("contentLanguage", "en");
  formData.set("primaryCategories", " Coding, Psychology ");
  formData.set("tags", " notes, tending ");
  return formData;
}

test("maps active revision values and effective Review lifecycle for the list", () => {
  const item = mapAdminContentListItem(
    contentRecord({
      titleEn: "Projection title",
      activeRevision: {
        ...contentRecord().activeRevision,
        lifecycle: "Review",
        titleEn: "Review title",
        growthStage: "Sprout",
      },
    }),
  );

  assert.equal(item.lifecycle, "Review");
  assert.equal(item.title, "Review title");
  assert.equal(item.growthStage, "Sprout");
  assert.equal(item.revisionLifecycle, "Review");
  assert.equal(item.lockVersion, 3);
});

test("blocks unauthorized content list reads before repository access", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  const service = createAdminContentManagementService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listContentRecords: async () => {
        repositoryCalls += 1;
        return [];
      },
    },
  });

  await assert.rejects(service.listContent(), (error) => error === denied);
  assert.equal(repositoryCalls, 0);
});

test("content list service authorizes, loads, and orders workbench records", async () => {
  const calls = [];
  const service = createAdminContentManagementService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-000000005b01" };
    },
    repository: {
      listContentRecords: async () => {
        calls.push("read");
        return [
          contentRecord(),
          contentRecord({
            contentId: "00000000-0000-4000-8000-000000005b21",
            updatedAt: "2026-07-16T11:00:00.000Z",
            activeRevision: null,
            lifecycle: "Published",
            titleEn: "Published path",
          }),
        ];
      },
    },
  });

  const content = await service.listContent();

  assert.deepEqual(calls, ["authorize", "read"]);
  assert.deepEqual(
    content.map(({ title }) => title),
    ["Published path", "A quiet Draft"],
  );
});

test("content list failures do not expose repository details", async () => {
  const service = createAdminContentManagementService({
    authorize: async () => ({
      id: "00000000-0000-4000-8000-000000005b01",
    }),
    repository: {
      listContentRecords: async () => {
        throw new Error("private public.contents SQL detail");
      },
    },
  });

  await assert.rejects(service.listContent(), (error) => {
    assert.ok(error instanceof ContentManagementUnavailableError);
    assert.doesNotMatch(error.message, /private|public\.|sql/i);
    return true;
  });
});

test("Create Draft form calls only the Content Admin service with editable fields", async () => {
  let received;
  const handlers = createContentFormHandlers({
    createDraft: async (input) => {
      received = input;
      return draftRevision();
    },
    updateDraft: async () => {
      throw new Error("not used");
    },
  });

  const result = await handlers.createDraft(
    {
      status: "idle",
      message: null,
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    },
    validFormData(),
  );

  assert.equal(result.status, "success");
  assert.equal(result.revisionId, draftRevision().revisionId);
  assert.deepEqual(received.primaryCategories, ["Coding", "Psychology"]);
  assert.deepEqual(received.tags, ["notes", "tending"]);
  assert.equal(received.titleEn, "A quiet Draft");
  assert.equal(received.createdBy, undefined);
  assert.equal(received.updatedAt, undefined);
  assert.equal(received.id, undefined);
});

test("validation errors are returned as safe field feedback", async () => {
  const handlers = createContentFormHandlers({
    createDraft: async () => {
      throw new ContentValidationError([
        {
          code: "missing_title",
          message: "At least one title is required.",
          field: "title",
          severity: "error",
        },
      ]);
    },
    updateDraft: async () => {
      throw new Error("not used");
    },
  });

  const result = await handlers.createDraft(
    {
      status: "idle",
      message: null,
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    },
    validFormData(),
  );

  assert.equal(result.status, "error");
  assert.deepEqual(result.fieldErrors.title, [
    "At least one title is required.",
  ]);
  assert.doesNotMatch(result.message, /sql|public\.|policy/i);
});

test("save preserves the optimistic lock token and reports the next revision", async () => {
  let received;
  const handlers = createContentFormHandlers({
    createDraft: async () => {
      throw new Error("not used");
    },
    updateDraft: async (input) => {
      received = input;
      return draftRevision({ lockVersion: 8 });
    },
  });
  const formData = validFormData();
  formData.set("contentId", draftRevision().contentId);
  formData.set("revisionId", draftRevision().revisionId);
  formData.set("expectedLockVersion", "7");

  const result = await handlers.saveDraft(
    {
      status: "idle",
      message: null,
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    },
    formData,
  );

  assert.equal(received.expectedLockVersion, 7);
  assert.equal(received.contentId, draftRevision().contentId);
  assert.equal(received.revisionId, draftRevision().revisionId);
  assert.equal(result.status, "success");
  assert.equal(result.lockVersion, 8);
});

test("optimistic lock conflicts require a reload and never expose internals", async () => {
  const handlers = createContentFormHandlers({
    createDraft: async () => {
      throw new Error("not used");
    },
    updateDraft: async () => {
      throw new ContentMutationError("revision_conflict", "updateDraft");
    },
  });
  const formData = validFormData();
  formData.set("contentId", draftRevision().contentId);
  formData.set("revisionId", draftRevision().revisionId);
  formData.set("expectedLockVersion", "2");

  const result = await handlers.saveDraft(
    {
      status: "idle",
      message: null,
      fieldErrors: {},
      revisionId: null,
      lockVersion: null,
      updatedAt: null,
    },
    formData,
  );

  assert.equal(result.status, "conflict");
  assert.match(result.message, /Reload/);
  assert.doesNotMatch(result.message, /content_revisions|lock_version|sql/i);
});

test("content routes keep authorization, loading, error, and service boundaries", () => {
  const page = fs.readFileSync(contentPagePath, "utf8");
  const loading = fs.readFileSync(contentLoadingPath, "utf8");
  const error = fs.readFileSync(contentErrorPath, "utf8");
  const actions = fs.readFileSync(contentActionsPath, "utf8");
  const form = fs.readFileSync(contentFormPath, "utf8");
  const protectedLayout = fs.readFileSync(protectedLayoutPath, "utf8");

  assert.match(protectedLayout, /await requireGardenKeeper\(\)/);
  assert.match(protectedLayout, /href="\/admin\/content"/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.doesNotMatch(page, /supabase|\.from\(/i);
  assert.match(page, /await listAdminContent\(\)/);
  assert.match(page, /Create Content/);
  assert.match(page, /The workbench is clear\./);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading content/);
  assert.match(error, /No internal details were revealed/);
  assert.match(actions, /createAdminContentService\(\)/);
  assert.match(actions, /\.createDraft\(previousState, formData\)/);
  assert.match(actions, /\.saveDraft\(previousState, formData\)/);
  assert.doesNotMatch(form, /supabase|requireGardenKeeper|createdBy|updatedBy/i);
  assert.doesNotMatch(form, /Publish|Archive|Delete|Upload/);
});
