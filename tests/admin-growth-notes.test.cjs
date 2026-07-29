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
  "lib/content/admin/growth-notes-service.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/growth-notes-repository.ts",
);
const validationPath = path.join(projectRoot, "lib/content/validation.ts");
const editorPagePath = path.join(
  projectRoot,
  "app/admin/(protected)/content/[revisionId]/page.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/growth-note-actions.ts",
);
const contractsPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/growth-note-action-contracts.ts",
);
const sectionPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/growth-notes-section.tsx",
);
const adminIndexPath = path.join(projectRoot, "lib/content/admin/index.ts");
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

Module._load = function loadWithGrowthNoteMocks(request, parent, isMain) {
  if (request === "server-only") return {};
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
        throw new Error("Tests must inject the Growth Notes repository.");
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
  GrowthNoteContentUnavailableError,
  GrowthNoteInputError,
  GrowthNoteNotFoundError,
  createGrowthNotesManagementService,
} = require(servicePath);
const { createGrowthNotesRepository } = require(repositoryPath);
const { validateGrowthStageConsistency } = require(validationPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const contentId = "00000000-0000-4000-8000-00000000aa31";
const noteId = "00000000-0000-4000-8000-00000000aa32";
const occurredAt = "2026-07-28T10:00:00.000Z";
const createdAt = "2026-07-28T10:05:00.000Z";
const contentSummary = {
  id: contentId,
  region: "Garden",
  contentType: "Seed",
  growthStage: "Seed",
};

function note(overrides = {}) {
  return {
    id: noteId,
    contentId,
    fromStage: "Seed",
    toStage: "Sprout",
    noteZh: "A tending note",
    noteEn: null,
    occurredAt,
    isPublic: false,
    createdAt,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    contentId,
    fromStage: "Seed",
    toStage: "Sprout",
    noteZh: "A tending note",
    noteEn: null,
    occurredAt,
    isPublic: true,
    ...overrides,
  };
}

function repositoryStub(overrides = {}) {
  return {
    getContentSummary: async () => contentSummary,
    listGrowthNotes: async () => [],
    createGrowthNote: async (_contentId, fields) => note(fields),
    updateGrowthNote: async (_contentId, _noteId, fields) => note(fields),
    deleteGrowthNote: async () => true,
    ...overrides,
  };
}

test("Growth Notes service authorizes, verifies content, and creates notes", async () => {
  const calls = [];
  const service = createGrowthNotesManagementService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: repositoryStub({
      getContentSummary: async (receivedContentId) => {
        calls.push(["content", receivedContentId]);
        return contentSummary;
      },
      createGrowthNote: async (receivedContentId, fields) => {
        calls.push(["create", receivedContentId, fields]);
        return note(fields);
      },
    }),
  });

  const created = await service.createGrowthNote(input());

  assert.equal(created.isPublic, true);
  assert.equal(created.toStage, "Sprout");
  assert.deepEqual(calls, [
    "authorize",
    ["content", contentId],
    [
      "create",
      contentId,
      {
        fromStage: "Seed",
        toStage: "Sprout",
        noteZh: "A tending note",
        noteEn: null,
        occurredAt,
        isPublic: true,
      },
    ],
  ]);
});

test("Growth Notes service updates and deletes only notes on growth-tracked content", async () => {
  const calls = [];
  const service = createGrowthNotesManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000aa21" }),
    repository: repositoryStub({
      getContentSummary: async () => contentSummary,
      updateGrowthNote: async (receivedContentId, receivedNoteId, fields) => {
        calls.push(["update", receivedContentId, receivedNoteId, fields.toStage]);
        return note(fields);
      },
      deleteGrowthNote: async (receivedContentId, receivedNoteId) => {
        calls.push(["delete", receivedContentId, receivedNoteId]);
        return true;
      },
    }),
  });

  await service.updateGrowthNote({
    ...input({ toStage: "Growing", noteEn: "A public note" }),
    noteId,
  });
  await service.deleteGrowthNote({ contentId, noteId });

  assert.deepEqual(calls, [
    ["update", contentId, noteId, "Growing"],
    ["delete", contentId, noteId],
  ]);
});

test("Growth Notes service validates ids, stages, dates, content, and missing notes safely", async () => {
  let authorized = false;
  const service = createGrowthNotesManagementService({
    authorize: async () => {
      authorized = true;
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: repositoryStub(),
  });

  await assert.rejects(
    service.createGrowthNote(input({ contentId: "not-a-uuid" })),
    GrowthNoteInputError,
  );
  await assert.rejects(
    service.createGrowthNote(input({ fromStage: "Seed", toStage: "Seed" })),
    GrowthNoteInputError,
  );
  await assert.rejects(
    service.createGrowthNote(input({ toStage: "Compost" })),
    GrowthNoteInputError,
  );
  await assert.rejects(
    service.createGrowthNote(input({ occurredAt: "sometime soon" })),
    GrowthNoteInputError,
  );
  await assert.rejects(
    service.createGrowthNote(input({ noteZh: " ", noteEn: "" })),
    GrowthNoteInputError,
  );
  assert.equal(authorized, false);

  const lakeService = createGrowthNotesManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000aa21" }),
    repository: repositoryStub({
      getContentSummary: async () => ({
        id: contentId,
        region: "Lake",
        contentType: "Reflection",
        growthStage: null,
      }),
    }),
  });

  await assert.rejects(
    lakeService.createGrowthNote(input({ fromStage: null })),
    GrowthNoteContentUnavailableError,
  );
});

test("Growth Notes service reports missing update/delete targets", async () => {
  const service = createGrowthNotesManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000aa21" }),
    repository: repositoryStub({
      updateGrowthNote: async () => null,
      deleteGrowthNote: async () => false,
    }),
  });

  await assert.rejects(
    service.updateGrowthNote({ ...input(), noteId }),
    GrowthNoteNotFoundError,
  );
  await assert.rejects(
    service.deleteGrowthNote({ contentId, noteId }),
    GrowthNoteNotFoundError,
  );
});

test("Growth Notes repository lists by occurredAt descending and preserves public/private flags", async () => {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "growth_notes");
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              const query = {
                order(orderColumn, options) {
                  calls.push(["order", orderColumn, options]);
                  if (orderColumn === "created_at") {
                    return Promise.resolve({
                      data: [
                        {
                          id: noteId,
                          content_id: contentId,
                          from_stage: "Seed",
                          to_stage: "Sprout",
                          note_zh: null,
                          note_en: "Private draft context",
                          occurred_at: occurredAt,
                          is_public: false,
                          created_at: createdAt,
                        },
                        {
                          id: "00000000-0000-4000-8000-00000000aa33",
                          content_id: contentId,
                          from_stage: "Sprout",
                          to_stage: "Growing",
                          note_zh: "Public note",
                          note_en: null,
                          occurred_at: "2026-07-29T10:00:00.000Z",
                          is_public: true,
                          created_at: "2026-07-29T10:05:00.000Z",
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
    },
  };

  const notes = await createGrowthNotesRepository(client).listGrowthNotes(
    contentId,
  );

  assert.deepEqual(
    notes.map(({ isPublic }) => isPublic),
    [false, true],
  );
  assert.deepEqual(calls, [
    ["select", "*"],
    ["eq", "content_id", contentId],
    ["order", "occurred_at", { ascending: false }],
    ["order", "created_at", { ascending: false }],
  ]);
});

test("Growth Notes repository creates, updates, and deletes with content scoping", async () => {
  const calls = [];
  const row = {
    id: noteId,
    content_id: contentId,
    from_stage: "Seed",
    to_stage: "Sprout",
    note_zh: "A tending note",
    note_en: null,
    occurred_at: occurredAt,
    is_public: true,
    created_at: createdAt,
  };
  const client = {
    from(table) {
      assert.equal(table, "growth_notes");
      return {
        insert(payload) {
          calls.push(["insert", payload]);
          return {
            select(columns) {
              calls.push(["insert-select", columns]);
              return {
                single: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        update(payload) {
          calls.push(["update", payload]);
          return {
            eq(column, value) {
              calls.push(["update-eq", column, value]);
              return this;
            },
            select(columns) {
              calls.push(["update-select", columns]);
              return {
                maybeSingle: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        delete() {
          calls.push(["delete"]);
          return {
            eq(column, value) {
              calls.push(["delete-eq", column, value]);
              return this;
            },
            select(columns) {
              calls.push(["delete-select", columns]);
              return {
                maybeSingle: async () => ({ data: { id: noteId }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const repository = createGrowthNotesRepository(client);
  await repository.createGrowthNote(contentId, input());
  await repository.updateGrowthNote(contentId, noteId, input());
  assert.equal(await repository.deleteGrowthNote(contentId, noteId), true);

  assert.deepEqual(calls, [
    [
      "insert",
      {
        content_id: contentId,
        from_stage: "Seed",
        to_stage: "Sprout",
        note_zh: "A tending note",
        note_en: null,
        occurred_at: occurredAt,
        is_public: true,
      },
    ],
    ["insert-select", "*"],
    [
      "update",
      {
        from_stage: "Seed",
        to_stage: "Sprout",
        note_zh: "A tending note",
        note_en: null,
        occurred_at: occurredAt,
        is_public: true,
      },
    ],
    ["update-eq", "id", noteId],
    ["update-eq", "content_id", contentId],
    ["update-select", "*"],
    ["delete"],
    ["delete-eq", "id", noteId],
    ["delete-eq", "content_id", contentId],
    ["delete-select", "id"],
  ]);
});

test("UI-created Growth Notes satisfy existing Growth Stage transition validation", () => {
  const result = validateGrowthStageConsistency(
    "Seed",
    "Sprout",
    [
      {
        contentId,
        fromStage: "Seed",
        toStage: "Sprout",
        noteZh: "A tending note",
        noteEn: null,
        isPublic: false,
      },
    ],
    contentId,
  );

  assert.equal(result.valid, true);
});

test("Growth Notes editor follows protected content editor patterns", () => {
  const page = fs.readFileSync(editorPagePath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");
  const contracts = fs.readFileSync(contractsPath, "utf8");
  const section = fs.readFileSync(sectionPath, "utf8");
  const adminIndex = fs.readFileSync(adminIndexPath, "utf8");

  assert.match(page, /await listGrowthNotes\(draft\.contentId\)/);
  assert.match(page, /requiresGrowthStage/);
  assert.match(page, /<GrowthNotesSection/);
  assert.doesNotMatch(page, /supabase|\.from\(|\.rpc\(/i);
  assert.match(actions, /["']use server["']/);
  assert.match(actions, /createGrowthNotesManagementService\(\)/);
  assert.match(actions, /revalidatePath\(`\/admin\/content\/\$\{revisionId\}`\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(section, /["']use client["']/);
  assert.match(section, /useActionState/);
  assert.match(section, /Create Growth Note/);
  assert.match(section, /Update/);
  assert.match(section, /Delete/);
  assert.match(section, /Public timeline/);
  assert.match(contracts, /INITIAL_GROWTH_NOTE_ACTION_STATE/);
  assert.match(adminIndex, /growth-notes-service/);
  assert.match(adminIndex, /growth-notes-repository/);
});
