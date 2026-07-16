/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const purgeSafetyPath = path.join(
  projectRoot,
  "lib/content/admin/storage-purge-safety.ts",
);
const repositoryPath = path.join(
  projectRoot,
  "lib/content/admin/storage-reference-repository.ts",
);
const storageMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260716040000_phase_04d_storage_reference_purge_safety.sql",
);
const deleteMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260716030000_phase_04d_delete_safety_foundation.sql",
);
const archiveMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260715235900_phase_04d_archive_foundation.sql",
);
const storagePolicyMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260714194046_phase_02d_storage_policies.sql",
);
const originalLoad = Module._load;

Module._load = function loadWithServerOnlyMock(request, parent, isMain) {
  if (request === "server-only") return {};
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
  evaluateStoragePurgeSafety,
  storageObjectMayPurge,
} = require(purgeSafetyPath);
const { createStorageReferenceRepository } = require(repositoryPath);

function evidence(overrides = {}) {
  return {
    bucket: "cover-images",
    objectPath: "contents/content-id/cover.webp",
    checkedAt: "2026-08-16T00:00:00.000Z",
    trackedReferenceCount: 0,
    projectionReferenceCount: 0,
    activeRevisionReferenceCount: 0,
    versionReferenceCount: 0,
    lifecycleState: "Quarantine",
    quarantineReason: "OrdinaryReplacement",
    quarantineStartedAt: "2026-07-16T00:00:00.000Z",
    quarantineUntil: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

test.after(() => {
  Module._load = originalLoad;
});

test("a referenced object cannot purge", () => {
  const decision = evaluateStoragePurgeSafety(
    evidence({
      trackedReferenceCount: 1,
      projectionReferenceCount: 1,
      lifecycleState: "Referenced",
      quarantineReason: null,
      quarantineStartedAt: null,
      quarantineUntil: null,
    }),
  );

  assert.equal(decision.eligible, false);
  assert.equal(storageObjectMayPurge(decision), false);
  assert.ok(decision.blockingReasons.includes("tracked_reference_present"));
  assert.ok(decision.blockingReasons.includes("projection_reference_present"));
});

test("an unreferenced replacement is quarantined before it becomes eligible", () => {
  const quarantined = evaluateStoragePurgeSafety(
    evidence({
      checkedAt: "2026-07-20T00:00:00.000Z",
      quarantineUntil: "2026-08-15T00:00:00.000Z",
    }),
  );
  const elapsed = evaluateStoragePurgeSafety(evidence());

  assert.equal(quarantined.eligible, false);
  assert.ok(quarantined.blockingReasons.includes("quarantine_not_elapsed"));
  assert.equal(elapsed.eligible, true);
  assert.equal(storageObjectMayPurge(elapsed), true);
});

test("an immutable version reference protects its object", () => {
  const decision = evaluateStoragePurgeSafety(
    evidence({ versionReferenceCount: 1 }),
  );

  assert.equal(decision.eligible, false);
  assert.ok(decision.blockingReasons.includes("version_reference_present"));
});

test("an active Draft or Review revision reference protects its object", () => {
  const decision = evaluateStoragePurgeSafety(
    evidence({ activeRevisionReferenceCount: 1 }),
  );

  assert.equal(decision.eligible, false);
  assert.ok(
    decision.blockingReasons.includes("active_revision_reference_present"),
  );
});

test("missing safety evidence fails closed", () => {
  const decision = evaluateStoragePurgeSafety(
    evidence({
      trackedReferenceCount: null,
      lifecycleState: null,
      quarantineReason: null,
      quarantineStartedAt: null,
      quarantineUntil: null,
    }),
  );

  assert.equal(decision.eligible, false);
  assert.ok(decision.blockingReasons.includes("safety_evidence_unavailable"));
  assert.ok(decision.blockingReasons.includes("lifecycle_record_missing"));
});

test("repository recomputes purge safety and exposes no delete operation", async () => {
  const calls = [];
  const repository = createStorageReferenceRepository({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        data: {
          ...evidence({ versionReferenceCount: 1 }),
          eligible: true,
          blockingReasons: [],
        },
        error: null,
      };
    },
  });

  const decision = await repository.inspectPurgeSafety({
    bucket: "cover-images",
    objectPath: "contents/content-id/cover.webp",
  });

  assert.equal(decision.eligible, false);
  assert.deepEqual(calls, [
    [
      "inspect_storage_object_purge_safety",
      {
        p_bucket: "cover-images",
        p_object_path: "contents/content-id/cover.webp",
      },
    ],
  ]);
  assert.equal("deleteObject" in repository, false);
  assert.equal("purgeObject" in repository, false);
});

test("migration tracks projection, revision, version, and archive checkpoint references", () => {
  const migration = fs.readFileSync(storageMigrationPath, "utf8");
  const archiveMigration = fs.readFileSync(archiveMigrationPath, "utf8");

  assert.match(migration, /create table public\.storage_object_references/i);
  for (const field of [
    "object_path",
    "bucket",
    "reference_owner_type",
    "reference_owner_id",
    "content_id",
    "reference_state",
    "created_at",
    "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`, "i"));
  }
  assert.match(migration, /contents_sync_storage_reference/i);
  assert.match(migration, /content_revisions_sync_storage_reference/i);
  assert.match(migration, /content_versions_sync_storage_references/i);
  assert.match(migration, /\{cover,path\}/i);
  assert.match(migration, /\{projection,cover,path\}/i);
  assert.match(archiveMigration, /checkpoint_reason[\s\S]*?'Archived'/i);
  assert.match(archiveMigration, /'cover',\s*cover_snapshot/i);
});

test("ordinary replacement gets 30 days and failed uploads use a separate grace contract", () => {
  const migration = fs.readFileSync(storageMigrationPath, "utf8");

  assert.match(
    migration,
    /release_storage_object_owner_references[\s\S]*?interval '30 days'/i,
  );
  assert.match(migration, /quarantine_failed_storage_upload/i);
  assert.match(migration, /p_grace_period interval/i);
  assert.match(migration, /'FailedUpload'/i);
  assert.match(migration, /mark_storage_object_post_delete_bypass/i);
});

test("permanent content deletion never removes Storage and versions remain protective", () => {
  const storageMigration = fs.readFileSync(storageMigrationPath, "utf8");
  const deleteMigration = fs.readFileSync(deleteMigrationPath, "utf8");
  const deleteFunctionStart = deleteMigration.search(
    /create function public\.delete_archived_content/i,
  );
  const deleteFunctionEnd = deleteMigration.indexOf(
    "comment on function public.delete_archived_content",
    deleteFunctionStart,
  );
  const deleteFunction = deleteMigration.slice(
    deleteFunctionStart,
    deleteFunctionEnd,
  );

  assert.doesNotMatch(
    deleteFunction,
    /(?:delete|update)\s+(?:from\s+)?storage\./i,
  );
  assert.match(
    storageMigration,
    /content_versions_sync_storage_references[\s\S]*?'ContentVersion'/i,
  );
  assert.doesNotMatch(storageMigration, /delete\s+from\s+storage\.objects/i);
});

test("direct browser Storage delete is blocked without changing bucket policies", () => {
  const migration = fs.readFileSync(storageMigrationPath, "utf8");
  const policies = fs.readFileSync(storagePolicyMigrationPath, "utf8");
  const policyDefinitions = policies.match(/create policy /gi) ?? [];

  assert.equal(policyDefinitions.length, 5);
  assert.doesNotMatch(migration, /(?:create|drop|alter)\s+policy/i);
  assert.match(
    migration,
    /revoke delete on table storage\.objects from public, anon, authenticated/i,
  );
  assert.doesNotMatch(migration, /grant delete[\s\S]*?to authenticated/i);
});
