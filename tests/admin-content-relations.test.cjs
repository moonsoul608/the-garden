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
  "lib/content/admin/content-relations-service.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/content-relations-repository.ts",
);
const editorPagePath = path.join(
  projectRoot,
  "app/admin/(protected)/content/[revisionId]/page.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/content-relation-actions.ts",
);
const contractsPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/content-relation-action-contracts.ts",
);
const sectionPath = path.join(
  projectRoot,
  "app/admin/(protected)/content/content-relations-section.tsx",
);
const adminIndexPath = path.join(projectRoot, "lib/content/admin/index.ts");
const publicRepositoryPath = path.join(projectRoot, "lib/content/repository.ts");

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

Module._load = function loadWithContentRelationMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-00000000bb21",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the Content Relations repository.");
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
  ContentRelationContentUnavailableError,
  ContentRelationDuplicateError,
  ContentRelationInputError,
  ContentRelationNotFoundError,
  createContentRelationsManagementService,
} = require(servicePath);
const { createContentRelationsRepository } = require(repositoryPath);

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

const sourceContentId = "00000000-0000-4000-8000-00000000bb31";
const targetContentId = "00000000-0000-4000-8000-00000000bb32";
const relationId = "00000000-0000-4000-8000-00000000bb33";
const createdAt = "2026-07-29T10:00:00.000Z";

function target(overrides = {}) {
  return {
    id: targetContentId,
    label: "Target title - Garden - 已发布 - Sprout",
    title: "Target title",
    region: "Garden",
    lifecycle: "Published",
    growthStage: "Sprout",
    slug: "target-title",
    ...overrides,
  };
}

function relation(overrides = {}) {
  return {
    id: relationId,
    sourceContentId,
    targetContentId,
    relationType: "relatedTo",
    noteZh: null,
    noteEn: "Useful context",
    createdAt,
    target: target(),
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    sourceContentId,
    targetContentId,
    relationType: "relatedTo",
    noteZh: null,
    noteEn: "Useful context",
    ...overrides,
  };
}

function repositoryStub(overrides = {}) {
  return {
    getExistingContentIds: async () =>
      new Set([sourceContentId, targetContentId]),
    listRelationTargets: async () => [target()],
    listOutgoingRelations: async () => [relation()],
    findDuplicateRelation: async () => null,
    createRelation: async (receivedSourceContentId, fields) =>
      relation({
        sourceContentId: receivedSourceContentId,
        ...fields,
      }),
    deleteRelation: async () => true,
    ...overrides,
  };
}

test("Content Relations service authorizes, validates content, and creates outgoing relations", async () => {
  const calls = [];
  const service = createContentRelationsManagementService({
    authorize: async () => {
      calls.push("authorize");
      return { id: "00000000-0000-4000-8000-00000000bb21" };
    },
    repository: repositoryStub({
      getExistingContentIds: async (ids) => {
        calls.push(["content", ids]);
        return new Set(ids);
      },
      findDuplicateRelation: async (fields) => {
        calls.push(["duplicate", fields]);
        return null;
      },
      createRelation: async (receivedSourceContentId, fields) => {
        calls.push(["create", receivedSourceContentId, fields]);
        return relation({ sourceContentId: receivedSourceContentId, ...fields });
      },
    }),
  });

  const created = await service.createRelation(
    input({ noteZh: "  ", noteEn: " Useful context " }),
  );

  assert.equal(created.relationType, "relatedTo");
  assert.equal(created.noteZh, null);
  assert.deepEqual(calls, [
    "authorize",
    ["content", [sourceContentId, targetContentId]],
    [
      "duplicate",
      {
        sourceContentId,
        targetContentId,
        relationType: "relatedTo",
        noteZh: null,
        noteEn: "Useful context",
      },
    ],
    [
      "create",
      sourceContentId,
      {
        targetContentId,
        relationType: "relatedTo",
        noteZh: null,
        noteEn: "Useful context",
      },
    ],
  ]);
});

test("Content Relations service deletes only outgoing relations for existing source content", async () => {
  const calls = [];
  const service = createContentRelationsManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000bb21" }),
    repository: repositoryStub({
      getExistingContentIds: async (ids) => {
        calls.push(["content", ids]);
        return new Set(ids);
      },
      deleteRelation: async (receivedSourceContentId, receivedRelationId) => {
        calls.push(["delete", receivedSourceContentId, receivedRelationId]);
        return true;
      },
    }),
  });

  await service.deleteRelation({ sourceContentId, relationId });

  assert.deepEqual(calls, [
    ["content", [sourceContentId]],
    ["delete", sourceContentId, relationId],
  ]);
});

test("Content Relations service rejects self, duplicate, invalid type, and unavailable content safely", async () => {
  let authorized = false;
  const service = createContentRelationsManagementService({
    authorize: async () => {
      authorized = true;
      return { id: "00000000-0000-4000-8000-00000000bb21" };
    },
    repository: repositoryStub(),
  });

  await assert.rejects(
    service.createRelation(input({ targetContentId: sourceContentId })),
    ContentRelationInputError,
  );
  await assert.rejects(
    service.createRelation(input({ relationType: "mirrors" })),
    ContentRelationInputError,
  );
  assert.equal(authorized, false);

  const duplicateService = createContentRelationsManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000bb21" }),
    repository: repositoryStub({
      findDuplicateRelation: async () => relation(),
    }),
  });
  await assert.rejects(
    duplicateService.createRelation(input()),
    ContentRelationDuplicateError,
  );

  const unavailableService = createContentRelationsManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000bb21" }),
    repository: repositoryStub({
      getExistingContentIds: async () => new Set([sourceContentId]),
    }),
  });
  await assert.rejects(
    unavailableService.createRelation(input()),
    ContentRelationContentUnavailableError,
  );

  const missingRelationService = createContentRelationsManagementService({
    authorize: async () => ({ id: "00000000-0000-4000-8000-00000000bb21" }),
    repository: repositoryStub({
      deleteRelation: async () => false,
    }),
  });
  await assert.rejects(
    missingRelationService.deleteRelation({ sourceContentId, relationId }),
    ContentRelationNotFoundError,
  );
});

test("Content Relations repository creates, checks duplicates, and deletes with source scoping", async () => {
  const calls = [];
  const row = {
    id: relationId,
    source_content_id: sourceContentId,
    target_content_id: targetContentId,
    relation_type: "grewInto",
    note_zh: null,
    note_en: "Useful context",
    created_at: createdAt,
  };
  const targetRow = {
    id: targetContentId,
    slug: "target-title",
    region: "Garden",
    lifecycle: "Published",
    growth_stage: "Sprout",
    title_zh: null,
    title_en: "Target title",
  };
  const client = {
    from(table) {
      return {
        select(columns) {
          calls.push([table, "select", columns]);
          return {
            in(column, values) {
              calls.push([table, "in", column, values]);
              return Promise.resolve({
                data: table === "contents" ? [targetRow] : [],
                error: null,
              });
            },
            eq(column, value) {
              calls.push([table, "select-eq", column, value]);
              return this;
            },
            maybeSingle: async () => ({ data: row, error: null }),
          };
        },
        insert(payload) {
          calls.push([table, "insert", payload]);
          return {
            select(columns) {
              calls.push([table, "insert-select", columns]);
              return {
                single: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        delete() {
          calls.push([table, "delete"]);
          return {
            eq(column, value) {
              calls.push([table, "delete-eq", column, value]);
              return this;
            },
            select(columns) {
              calls.push([table, "delete-select", columns]);
              return {
                maybeSingle: async () => ({ data: { id: relationId }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const repository = createContentRelationsRepository(client);
  await repository.findDuplicateRelation({
    sourceContentId,
    targetContentId,
    relationType: "grewInto",
    noteZh: null,
    noteEn: "Useful context",
  });
  await repository.createRelation(sourceContentId, {
    targetContentId,
    relationType: "grewInto",
    noteZh: null,
    noteEn: "Useful context",
  });
  assert.equal(await repository.deleteRelation(sourceContentId, relationId), true);

  assert.deepEqual(calls.slice(0, 7), [
    ["content_relations", "select", "*"],
    ["content_relations", "select-eq", "source_content_id", sourceContentId],
    ["content_relations", "select-eq", "target_content_id", targetContentId],
    ["content_relations", "select-eq", "relation_type", "grewInto"],
    [
      "contents",
      "select",
      "id,slug,region,lifecycle,growth_stage,title_zh,title_en",
    ],
    ["contents", "in", "id", [targetContentId]],
    [
      "content_relations",
      "insert",
      {
        source_content_id: sourceContentId,
        target_content_id: targetContentId,
        relation_type: "grewInto",
        note_zh: null,
        note_en: "Useful context",
      },
    ],
  ]);
  assert.deepEqual(calls.slice(-4), [
    ["content_relations", "delete"],
    ["content_relations", "delete-eq", "id", relationId],
    ["content_relations", "delete-eq", "source_content_id", sourceContentId],
    ["content_relations", "delete-select", "id"],
  ]);
});

test("Content Relations editor follows protected content editor patterns", () => {
  const page = fs.readFileSync(editorPagePath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");
  const contracts = fs.readFileSync(contractsPath, "utf8");
  const section = fs.readFileSync(sectionPath, "utf8");
  const adminIndex = fs.readFileSync(adminIndexPath, "utf8");

  assert.match(page, /await Promise\.all\(\[/);
  assert.match(page, /listOutgoingContentRelations\(draft\.contentId\)/);
  assert.match(page, /listContentRelationTargets\(draft\.contentId\)/);
  assert.match(page, /<ContentRelationsSection/);
  assert.doesNotMatch(page, /supabase|\.from\(|\.rpc\(/i);
  assert.match(actions, /["']use server["']/);
  assert.match(actions, /createContentRelationsManagementService\(\)/);
  assert.match(actions, /revalidatePath\(`\/admin\/content\/\$\{revisionId\}`\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(section, /["']use client["']/);
  assert.match(section, /useActionState/);
  assert.match(section, /创建 Content Relations/);
  assert.match(section, /删除/);
  assert.match(section, /targetContentId/);
  assert.match(contracts, /INITIAL_CONTENT_RELATION_ACTION_STATE/);
  assert.match(adminIndex, /content-relations-service/);
  assert.match(adminIndex, /content-relations-repository/);
});

test("public outgoing relation rendering remains backed by content_relations", () => {
  const publicRepository = fs.readFileSync(publicRepositoryPath, "utf8");

  assert.match(publicRepository, /\.from\("content_relations"\)/);
  assert.match(publicRepository, /\.eq\("source_content_id", row\.id\)/);
  assert.match(publicRepository, /\.eq\("lifecycle", "Published"\)/);
  assert.doesNotMatch(publicRepository, /createContentRelationsManagementService/);
});
