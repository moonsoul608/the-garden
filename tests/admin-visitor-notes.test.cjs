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
  "lib/content/admin/visitor-notes-service.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/visitor-notes-repository.ts",
);
const pagePath = path.join(
  projectRoot,
  "app/admin/(protected)/notes/page.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/notes/actions.ts",
);
const actionContractsPath = path.join(
  projectRoot,
  "app/admin/(protected)/notes/action-contracts.ts",
);
const noteActionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/notes/note-actions.tsx",
);
const layoutPath = path.join(
  projectRoot,
  "app/admin/(protected)/layout.tsx",
);
const adminIndexPath = path.join(projectRoot, "lib/content/admin/index.ts");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

class MockVisitorNoteInputError extends Error {}
class MockVisitorNotesManagementUnavailableError extends Error {}

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

Module._load = function loadWithVisitorNoteMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "@/lib/content/admin" && parent?.filename === actionsPath) {
    return {
      VisitorNoteInputError: MockVisitorNoteInputError,
      VisitorNotesManagementUnavailableError:
        MockVisitorNotesManagementUnavailableError,
      createVisitorNotesManagementService: () => ({
        markVisitorNoteReadState: async () => {},
        deleteVisitorNote: async () => {},
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
        throw new Error("Tests must inject the visitor notes repository.");
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
  VisitorNoteInputError,
  createVisitorNotesManagementService,
} = require(servicePath);
const { createVisitorNotesRepository } = require(repositoryPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const noteId = "00000000-0000-4000-8000-00000000aa31";
const createdAt = "2026-07-28T10:00:00.000Z";

function form(fields) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

test("visitor notes service authorizes before reading notes", async () => {
  const calls = [];
  const service = createVisitorNotesManagementService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: {
      listVisitorNotes: async () => {
        calls.push("read");
        return [
          {
            id: noteId,
            name: "Xianhong",
            message: "A private note",
            status: "unread",
            createdAt,
          },
        ];
      },
      markVisitorNoteReadState: async () => {
        throw new Error("markVisitorNoteReadState was not expected");
      },
      deleteVisitorNote: async () => {
        throw new Error("deleteVisitorNote was not expected");
      },
    },
  });

  assert.equal((await service.listVisitorNotes())[0].status, "unread");
  assert.deepEqual(calls, ["authorize", "read"]);
});

test("visitor notes service blocks unauthorized reads before repository access", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  const service = createVisitorNotesManagementService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listVisitorNotes: async () => {
        repositoryCalls += 1;
        return [];
      },
      markVisitorNoteReadState: async () => {
        repositoryCalls += 1;
      },
      deleteVisitorNote: async () => {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(service.listVisitorNotes(), (error) => error === denied);
  assert.equal(repositoryCalls, 0);
});

test("visitor notes service validates note ids before mutation access", async () => {
  let authorized = false;
  const service = createVisitorNotesManagementService({
    authorize: async () => {
      authorized = true;
      return { id: "00000000-0000-4000-8000-00000000aa21" };
    },
    repository: {
      listVisitorNotes: async () => [],
      markVisitorNoteReadState: async () => {},
      deleteVisitorNote: async () => {},
    },
  });

  await assert.rejects(
    service.markVisitorNoteReadState({ noteId: "not-a-uuid", isRead: true }),
    VisitorNoteInputError,
  );
  assert.equal(authorized, false);
});

test("visitor notes repository lists unread notes first and maps private rows", async () => {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "visitor_notes");
      return {
        select(columns) {
          calls.push(["select", columns]);
          const query = {
            order(column, options) {
              calls.push(["order", column, options]);
              if (column === "created_at") {
                return Promise.resolve({
                  data: [
                    {
                      id: noteId,
                      name: null,
                      message: "Hello garden",
                      is_read: false,
                      created_at: createdAt,
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

  const notes = await createVisitorNotesRepository(client).listVisitorNotes();

  assert.deepEqual(notes, [
    {
      id: noteId,
      name: null,
      message: "Hello garden",
      status: "unread",
      createdAt,
    },
  ]);
  assert.deepEqual(calls, [
    ["select", "id,name,message,is_read,created_at"],
    ["order", "is_read", { ascending: true }],
    ["order", "created_at", { ascending: false }],
  ]);
});

test("visitor notes repository marks read state and deletes by note id", async () => {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "visitor_notes");
      return {
        update(payload) {
          calls.push(["update", payload]);
          return {
            eq(column, value) {
              calls.push(["update-eq", column, value]);
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          calls.push(["delete"]);
          return {
            eq(column, value) {
              calls.push(["delete-eq", column, value]);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const repository = createVisitorNotesRepository(client);
  await repository.markVisitorNoteReadState(noteId, true);
  await repository.deleteVisitorNote(noteId);

  assert.deepEqual(calls, [
    ["update", { is_read: true }],
    ["update-eq", "id", noteId],
    ["delete"],
    ["delete-eq", "id", noteId],
  ]);
});

test("visitor note actions map mutations to safe states", async () => {
  const actions = require(actionsPath);
  const read = await actions.markVisitorNoteReadAction(
    { status: "idle", message: null },
    form({ noteId }),
  );

  const unread = await actions.markVisitorNoteUnreadAction(
    { status: "idle", message: null },
    form({ noteId }),
  );

  const deleted = await actions.deleteVisitorNoteAction(
    { status: "idle", message: null },
    form({ noteId }),
  );

  assert.equal(read.status, "success");
  assert.equal(unread.status, "success");
  assert.equal(deleted.status, "success");
});

test("visitor notes route follows protected admin patterns", () => {
  const page = fs.readFileSync(pagePath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");
  const contracts = fs.readFileSync(actionContractsPath, "utf8");
  const noteActions = fs.readFileSync(noteActionsPath, "utf8");
  const layout = fs.readFileSync(layoutPath, "utf8");
  const adminIndex = fs.readFileSync(adminIndexPath, "utf8");

  assert.match(layout, /await requireGardenKeeper\(\)/);
  assert.match(layout, /href="\/admin\/notes"/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(page, /await listVisitorNotes\(\)/);
  assert.doesNotMatch(page, /supabase|\.from\(|\.rpc\(/i);
  assert.match(noteActions, /["']use client["']/);
  assert.match(noteActions, /useActionState/);
  assert.match(noteActions, /Mark as read/);
  assert.match(noteActions, /Mark as unread/);
  assert.match(noteActions, /Delete/);
  assert.match(actions, /["']use server["']/);
  assert.match(actions, /revalidatePath\("\/admin\/notes"\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(contracts, /INITIAL_VISITOR_NOTE_ACTION_STATE/);
  assert.match(adminIndex, /visitor-notes-service/);
  assert.match(adminIndex, /visitor-notes-repository/);
});
