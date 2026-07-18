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
const archiveRepositoryPath = path.join(
  projectRoot,
  "lib/content/admin/archive-repository.ts",
);
const restoreRepositoryPath = path.join(
  projectRoot,
  "lib/content/admin/restore-repository.ts",
);
const deletionRepositoryPath = path.join(
  projectRoot,
  "lib/content/admin/deletion-repository.ts",
);
const contentErrorsPath = path.join(projectRoot, "lib/content/errors.ts");
const mutationErrorsPath = path.join(
  projectRoot,
  "lib/content/admin/errors.ts",
);
const draftManagementMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260715223000_phase_04c_draft_management.sql",
);
const reviewWorkflowMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260715233000_phase_04c_review_workflow.sql",
);
const atomicPublishingMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260715234500_phase_04d_atomic_publishing.sql",
);
const growthStageApplicabilityMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260718190000_phase_08a2_growth_stage_applicability.sql",
);
const growthStageApplicabilitySyncMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260718235551_growth_stage_schema_applicability_sync.sql",
);
const archiveFoundationMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260715235900_phase_04d_archive_foundation.sql",
);
const restoreFoundationMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260716010000_phase_04d_restore_foundation.sql",
);
const deleteSafetyMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260716030000_phase_04d_delete_safety_foundation.sql",
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
const { createArchiveRepository } = require(archiveRepositoryPath);
const { createRestoreRepository } = require(restoreRepositoryPath);
const { createDeletionRepository } = require(deletionRepositoryPath);

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

function draftRevision(overrides = {}) {
  return {
    contentId: "content-id",
    revisionId: "revision-id",
    lifecycle: "Draft",
    lockVersion: 1,
    sourceVersionId: null,
    baseContentUpdatedAt: null,
    reviewSubmittedAt: null,
    returnedToDraftAt: null,
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
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
    ...overrides,
  };
}

function reviewReadyRevision(overrides = {}) {
  return draftRevision({
    summaryEn: "A complete summary.",
    bodyEnMarkdown: "A complete body.",
    primaryCategories: ["Coding"],
    ...overrides,
  });
}

function reviewContext(overrides = {}) {
  return {
    publishedProjection: null,
    slugConflicts: [],
    growthNotes: [],
    relations: [],
    existingContentIds: [],
    ...overrides,
  };
}

function publicationReceipt(overrides = {}) {
  return {
    contentId: "content-id",
    revisionId: "revision-id",
    versionId: "version-id",
    sourceLockVersion: 4,
    publishedAt: "2026-07-15T12:00:00.000Z",
    publishedBy: keeper.id,
    ...overrides,
  };
}

function archiveInput(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000004b01",
    expectedUpdatedAt: "2026-07-15T12:00:00.000Z",
    operationId: "00000000-0000-4000-8000-000000004c01",
    ...overrides,
  };
}

function archiveReceipt(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000004b01",
    operationId: "00000000-0000-4000-8000-000000004c01",
    versionId: "00000000-0000-4000-8000-000000004d01",
    archivedAt: "2026-07-15T12:01:00.000Z",
    archivedBy: keeper.id,
    ...overrides,
  };
}

function restoreInput(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000004b01",
    sourceVersionId: "00000000-0000-4000-8000-000000004d01",
    expectedArchivedToken: "2026-07-15T12:01:00.000Z",
    operationId: "00000000-0000-4000-8000-000000004e01",
    ...overrides,
  };
}

function restoreReceipt(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000004b01",
    sourceVersionId: "00000000-0000-4000-8000-000000004d01",
    revisionId: "00000000-0000-4000-8000-000000004f01",
    operationId: "00000000-0000-4000-8000-000000004e01",
    preRestoreVersionId: "00000000-0000-4000-8000-000000004d02",
    lockVersion: 1,
    restoredAt: "2026-07-15T12:02:00.000Z",
    restoredBy: keeper.id,
    ...overrides,
  };
}

function deletionImpactPreview(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000004b01",
    lifecycle: "Archived",
    expectedArchivedToken: "2026-07-15T12:01:00.000Z",
    canonicalRoute: "/garden/delete-safety",
    historicalRoutes: ["/forest/delete-safety-old"],
    redirectReferences: [
      {
        routePath: "/forest/delete-safety-old",
        destinationPath: "/garden/delete-safety",
        statusCode: 308,
      },
    ],
    versionCount: 2,
    revisionStatus: {
      active: false,
      revisionId: null,
      lifecycle: null,
      lockVersion: null,
    },
    inboundRelations: [
      {
        relationId: "00000000-0000-4000-8000-000000004a11",
        relatedContentId: "00000000-0000-4000-8000-000000004a12",
        relationType: "grewInto",
      },
    ],
    outboundRelations: [
      {
        relationId: "00000000-0000-4000-8000-000000004a13",
        relatedContentId: "00000000-0000-4000-8000-000000004a14",
        relationType: "relatedTo",
      },
    ],
    storageReferenceCount: 2,
    affectedInvalidationSurfaces: [
      "route",
      "metadata",
      "sitemap",
      "search",
    ],
    impactDigest: "0123456789abcdef0123456789abcdef",
    ...overrides,
  };
}

function deleteInput(overrides = {}) {
  const preview = deletionImpactPreview();
  return {
    contentId: preview.contentId,
    expectedArchivedToken: preview.expectedArchivedToken,
    impactDigest: preview.impactDigest,
    operationId: "00000000-0000-4000-8000-000000004e02",
    ...overrides,
  };
}

function deletionReceipt(overrides = {}) {
  return {
    status: "deleted",
    contentId: "00000000-0000-4000-8000-000000004b01",
    operationId: "00000000-0000-4000-8000-000000004e02",
    deletedAt: "2026-07-15T12:03:00.000Z",
    deletedBy: keeper.id,
    impactCounts: {
      canonicalRouteCount: 1,
      historicalRouteCount: 1,
      redirectReferenceCount: 1,
      versionCount: 2,
      revisionCount: 0,
      inboundRelationCount: 1,
      outboundRelationCount: 1,
      storageReferenceCount: 2,
      invalidationSurfaceCount: 4,
    },
    tombstoneResult: {
      requestedCount: 2,
      createdCount: 2,
      insertedCount: 1,
      convertedCount: 1,
    },
    ...overrides,
  };
}

function repositoryStub(overrides = {}) {
  return {
    createDraft: async () => {
      throw new Error("Unexpected createDraft call");
    },
    getDraftById: async () => null,
    listDrafts: async () => [],
    getContentWorkflowState: async () => null,
    getDraftRevision: async () => null,
    updateDraft: async () => {
      throw new Error("Unexpected updateDraft call");
    },
    getReviewPreparationContext: async () => reviewContext(),
    submitForReview: async () => {
      throw new Error("Unexpected submitForReview call");
    },
    returnToDraft: async () => {
      throw new Error("Unexpected returnToDraft call");
    },
    publishReview: async () => {
      throw new Error("Unexpected publishReview call");
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
    () =>
      service.submitForReview({
        contentId: "content-id",
        revisionId: "revision-id",
        expectedLockVersion: 1,
      }),
    () =>
      service.returnToDraft({
        contentId: "content-id",
        revisionId: "revision-id",
        expectedLockVersion: 1,
      }),
    () =>
      service.publishReview({
        contentId: "content-id",
        revisionId: "revision-id",
        expectedLockVersion: 1,
      }),
    () => service.archiveContent(archiveInput()),
    () => service.restoreVersionToDraft(restoreInput()),
    () =>
      service.previewDeletionImpact({
        contentId: deleteInput().contentId,
      }),
    () => service.deleteArchivedContent(deleteInput()),
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
    restoreRepository: {
      restoreVersionToDraft: async () => {
        repositoryCalls += 1;
      },
    },
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
    restoreRepository: {
      restoreVersionToDraft: async () => {
        repositoryCalls += 1;
      },
    },
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

test("allows a Keeper to create a normalized Draft", async () => {
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

test("enforces Growth Stage applicability for every content domain", async () => {
  const created = [];
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      createDraft: async (fields) => {
        created.push(fields);
        return draftRevision(fields);
      },
    }),
  });

  const lake = await service.createDraft({
    ...validDraftInput(),
    region: "Lake",
    contentType: "Reflection",
    growthStage: null,
  });
  assert.equal(lake.growthStage, null);
  assert.equal(created[0].growthStage, null);

  for (const [region, contentType] of [
    ["Garden", "Seed"],
    ["Forest", "Question"],
    ["Ruins", "Trace"],
  ]) {
    await assert.rejects(
      service.createDraft({
        ...validDraftInput(),
        region,
        contentType,
        growthStage: null,
      }),
      (error) => {
        assert.ok(error instanceof ContentValidationError);
        assert.ok(
          error.issues.some((issue) => issue.code === "missing_growth_stage"),
        );
        return true;
      },
    );
  }
});

test("keeps every existing Growth Stage enum value valid", async () => {
  const stages = ["Seed", "Sprout", "Growing", "Bloom", "Dormant"];
  const received = [];
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      createDraft: async (fields) => {
        received.push(fields.growthStage);
        return draftRevision(fields);
      },
    }),
  });

  for (const growthStage of stages) {
    await service.createDraft({ ...validDraftInput(), growthStage });
  }
  assert.deepEqual(received, stages);
});

test("updates only the active Draft with the expected lock version", async () => {
  const current = draftRevision({ lockVersion: 4 });
  const updated = draftRevision({
    lockVersion: 5,
    titleEn: "Changed title",
  });
  let received;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async (contentId, revisionId) => {
        assert.equal(contentId, current.contentId);
        assert.equal(revisionId, current.revisionId);
        return current;
      },
      updateDraft: async (activeDraft, fields, expectedLockVersion) => {
        received = { activeDraft, fields, expectedLockVersion };
        return updated;
      },
    }),
  });

  const result = await service.updateDraft({
    contentId: current.contentId,
    revisionId: current.revisionId,
    expectedLockVersion: 4,
    changes: { titleEn: "  Changed title  " },
  });

  assert.equal(result, updated);
  assert.equal(received.activeDraft, current);
  assert.equal(received.expectedLockVersion, 4);
  assert.equal(received.fields.titleEn, "Changed title");
});

test("returns revision_conflict for a stale Draft lock version", async () => {
  const current = draftRevision({ lockVersion: 5 });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      updateDraft: async (_activeDraft, _fields, expectedLockVersion) => {
        assert.equal(expectedLockVersion, 4);
        throw new ContentMutationError("revision_conflict", "updateDraft");
      },
    }),
  });

  await assert.rejects(
    service.updateDraft({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 4,
      changes: { titleEn: "Stale title" },
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "revision_conflict");
      assert.equal(error.operation, "updateDraft");
      return true;
    },
  );
});

test("allows a Keeper to submit a valid Draft for Review", async () => {
  const current = reviewReadyRevision({ lockVersion: 3 });
  const reviewed = reviewReadyRevision({
    lifecycle: "Review",
    lockVersion: 4,
    reviewSubmittedAt: "2026-07-15T11:00:00.000Z",
  });
  let transition;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () => reviewContext(),
      submitForReview: async (revision, expectedLockVersion) => {
        transition = { revision, expectedLockVersion };
        return reviewed;
      },
    }),
  });

  assert.equal(
    await service.submitForReview({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 3,
    }),
    reviewed,
  );
  assert.equal(transition.revision, current);
  assert.equal(transition.expectedLockVersion, 3);
  assert.equal(reviewed.lifecycle, "Review");
  assert.equal(reviewed.lockVersion, 4);
});

test("rejects an invalid Draft before Review transition", async () => {
  const current = draftRevision();
  let transitionCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () => reviewContext(),
      submitForReview: async () => {
        transitionCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.submitForReview({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 1,
    }),
    (error) => {
      assert.ok(error instanceof ContentValidationError);
      assert.deepEqual(
        error.issues.map((issue) => issue.code),
        ["missing_summary", "missing_body", "missing_primary_category"],
      );
      return true;
    },
  );
  assert.equal(transitionCalls, 0);
});

test("prepareReview returns normalized readiness and Published differences", async () => {
  const published = reviewReadyRevision({
    titleEn: "Published title",
    tags: ["Notes"],
  });
  const current = reviewReadyRevision({
    titleEn: "  Revised title  ",
    tags: ["AI", "Notes"],
  });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () =>
        reviewContext({ publishedProjection: published }),
    }),
  });

  const report = await service.prepareReview({
    contentId: current.contentId,
    revisionId: current.revisionId,
  });

  assert.equal(report.ready, true);
  assert.equal(report.normalizedCandidate.titleEn, "Revised title");
  assert.deepEqual(report.validationIssues, []);
  assert.equal(report.coverStatus.state, "absent");
  assert.equal(report.growthStageConsistency.changed, false);
  assert.equal(report.differenceFromPublished.kind, "changed");
  assert.deepEqual(report.differenceFromPublished.changedFields, [
    "titleEn",
    "tags",
  ]);
});

test("prepareReview reports slug, cover, Growth Note, and relation issues", async () => {
  const current = reviewReadyRevision({
    growthStage: "Sprout",
    cover: { path: "covers/first-draft.webp", altZh: null, altEn: null },
  });
  const published = reviewReadyRevision({ growthStage: "Seed" });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () =>
        reviewContext({
          publishedProjection: published,
          slugConflicts: [
            { contentId: "conflicting-content", lifecycle: "Archived" },
          ],
          relations: [
            {
              sourceContentId: current.contentId,
              targetContentId: "missing-target",
              relationType: "relatedTo",
              noteZh: null,
              noteEn: null,
            },
          ],
          existingContentIds: [current.contentId],
        }),
    }),
  });

  const report = await service.prepareReview({
    contentId: current.contentId,
    revisionId: current.revisionId,
  });

  assert.equal(report.ready, false);
  assert.deepEqual(
    report.validationIssues.map((issue) => issue.code),
    [
      "missing_cover_alt",
      "slug_conflict",
      "missing_growth_note",
      "unresolved_relation",
    ],
  );
  assert.deepEqual(
    report.missingRequirements.map((issue) => issue.code),
    ["missing_cover_alt", "missing_growth_note", "unresolved_relation"],
  );
  assert.equal(report.slugConflicts.length, 1);
  assert.equal(report.coverStatus.state, "missing_alt");
  assert.equal(report.growthStageConsistency.changed, true);
  assert.equal(report.growthStageConsistency.hasMatchingGrowthNote, false);
  assert.equal(report.relationIssues[0].code, "unresolved_relation");
});

test("Review revisions are read-only through updateDraft", async () => {
  const current = reviewReadyRevision({ lifecycle: "Review" });
  let updateCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      updateDraft: async () => {
        updateCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.updateDraft({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 1,
      changes: { titleEn: "Edited in Review" },
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "revision_not_editable");
      assert.equal(error.operation, "updateDraft");
      return true;
    },
  );
  assert.equal(updateCalls, 0);
});

test("allows a Review revision to return to Draft", async () => {
  const current = reviewReadyRevision({ lifecycle: "Review", lockVersion: 7 });
  const returned = reviewReadyRevision({
    lifecycle: "Draft",
    lockVersion: 8,
    returnedToDraftAt: "2026-07-15T11:30:00.000Z",
  });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      returnToDraft: async (revision, expectedLockVersion) => {
        assert.equal(revision, current);
        assert.equal(expectedLockVersion, 7);
        return returned;
      },
    }),
  });

  assert.equal(
    await service.returnToDraft({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 7,
    }),
    returned,
  );
  assert.equal(returned.lifecycle, "Draft");
  assert.equal(returned.lockVersion, 8);
});

test("returns revision_conflict for a stale Review submission lock", async () => {
  const current = reviewReadyRevision({ lockVersion: 5 });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () => reviewContext(),
      submitForReview: async (_revision, expectedLockVersion) => {
        assert.equal(expectedLockVersion, 4);
        throw new ContentMutationError(
          "revision_conflict",
          "submitForReview",
        );
      },
    }),
  });

  await assert.rejects(
    service.submitForReview({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 4,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "revision_conflict");
      assert.equal(error.operation, "submitForReview");
      return true;
    },
  );
});

test("allows a Keeper to publish a valid Review through the atomic command", async () => {
  const current = reviewReadyRevision({
    lifecycle: "Review",
    lockVersion: 4,
    reviewSubmittedAt: "2026-07-15T11:00:00.000Z",
  });
  const input = {
    contentId: current.contentId,
    revisionId: current.revisionId,
    expectedLockVersion: 4,
  };
  const expected = publicationReceipt();
  let received;
  let validationContextCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub({
      getDraftRevision: async (contentId, revisionId) => {
        assert.equal(contentId, current.contentId);
        assert.equal(revisionId, current.revisionId);
        return current;
      },
      getReviewPreparationContext: async (revision) => {
        validationContextCalls += 1;
        assert.equal(revision, current);
        return reviewContext();
      },
      publishReview: async (publishInput) => {
        received = publishInput;
        return expected;
      },
    }),
  });

  const result = await service.publishReview(input);

  assert.deepEqual(result, expected);
  assert.deepEqual(received, input);
  assert.equal(validationContextCalls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
});

test("denies a non-Keeper publish before repository access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => {
      throw new GardenKeeperRequiredError();
    },
    sourceMode: "database",
    repository: repositoryStub({
      getDraftRevision: async () => {
        repositoryCalls += 1;
      },
      publishReview: async () => {
        repositoryCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.publishReview({
      contentId: "content-id",
      revisionId: "revision-id",
      expectedLockVersion: 4,
    }),
    GardenKeeperRequiredError,
  );
  assert.equal(repositoryCalls, 0);
});

test("rejects a Draft publish before the atomic repository command", async () => {
  const current = reviewReadyRevision({ lifecycle: "Draft", lockVersion: 4 });
  let publishCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub({
      getDraftRevision: async () => current,
      publishReview: async () => {
        publishCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.publishReview({
      contentId: current.contentId,
      revisionId: current.revisionId,
      expectedLockVersion: 4,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "invalid_revision_state");
      assert.equal(error.operation, "publishReview");
      return true;
    },
  );
  assert.equal(publishCalls, 0);
});

test("disables publishing while the content source is legacy", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "legacy",
    repository: repositoryStub({
      getDraftRevision: async () => {
        repositoryCalls += 1;
      },
      publishReview: async () => {
        repositoryCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.publishReview({
      contentId: "content-id",
      revisionId: "revision-id",
      expectedLockVersion: 4,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "publishing_disabled");
      assert.equal(error.operation, "publishReview");
      return true;
    },
  );
  assert.equal(repositoryCalls, 0);
});

test("lets an idempotent publish retry reach the RPC after Review consumption", async () => {
  const input = {
    contentId: "content-id",
    revisionId: "revision-id",
    expectedLockVersion: 4,
  };
  const expected = publicationReceipt();
  let received;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub({
      getDraftRevision: async () => null,
      publishReview: async (publishInput) => {
        received = publishInput;
        return expected;
      },
    }),
  });

  assert.deepEqual(await service.publishReview(input), expected);
  assert.deepEqual(received, input);
});

test("rejects a stale publish lock before validation or repository access", async () => {
  const current = reviewReadyRevision({ lifecycle: "Review", lockVersion: 5 });
  const input = {
    contentId: current.contentId,
    revisionId: current.revisionId,
    expectedLockVersion: 4,
  };
  let validationCalls = 0;
  let publishCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () => {
        validationCalls += 1;
        return reviewContext();
      },
      publishReview: async () => {
        publishCalls += 1;
      },
    }),
  });

  await assert.rejects(service.publishReview(input), (error) => {
    assert.ok(error instanceof ContentMutationError);
    assert.equal(error.code, "revision_conflict");
    assert.equal(error.operation, "publishReview");
    return true;
  });
  assert.equal(validationCalls, 0);
  assert.equal(publishCalls, 0);
});

test("Review transitions leave the Published projection unchanged", async () => {
  const publishedProjection = Object.freeze(
    reviewReadyRevision({
      lifecycle: "Draft",
      titleEn: "Published title",
    }),
  );
  const before = structuredClone(publishedProjection);
  const current = reviewReadyRevision({ titleEn: "Review candidate" });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => current,
      getReviewPreparationContext: async () =>
        reviewContext({ publishedProjection }),
      submitForReview: async () =>
        reviewReadyRevision({
          lifecycle: "Review",
          titleEn: current.titleEn,
          lockVersion: 2,
        }),
    }),
  });

  await service.submitForReview({
    contentId: current.contentId,
    revisionId: current.revisionId,
    expectedLockVersion: 1,
  });
  assert.deepEqual(publishedProjection, before);
});

test("starts a Draft revision from Published content without mutating its projection", async () => {
  const publishedProjection = Object.freeze({
    contentId: "published-content",
    lifecycle: "Published",
    titleEn: "Published title",
    updatedAt: "2026-07-15T09:00:00.000Z",
  });
  const before = { ...publishedProjection };
  const started = draftRevision({
    contentId: publishedProjection.contentId,
    revisionId: "new-revision",
    sourceVersionId: "source-version",
    baseContentUpdatedAt: publishedProjection.updatedAt,
    titleEn: publishedProjection.titleEn,
  });
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getContentWorkflowState: async () => ({
        contentId: publishedProjection.contentId,
        lifecycle: publishedProjection.lifecycle,
      }),
      startDraftRevision: async () => started,
    }),
  });

  assert.equal(
    await service.startDraftRevision({
      contentId: publishedProjection.contentId,
    }),
    started,
  );
  assert.deepEqual(publishedProjection, before);
  assert.equal(started.lifecycle, "Draft");
  assert.equal(started.sourceVersionId, "source-version");
  assert.equal(started.lockVersion, 1);
});

test("rejects a direct Draft lifecycle change before repository access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftRevision: async () => {
        repositoryCalls += 1;
        return draftRevision();
      },
    }),
  });

  await assert.rejects(
    service.updateDraft({
      contentId: "content-id",
      revisionId: "revision-id",
      expectedLockVersion: 1,
      changes: { lifecycle: "Published" },
    }),
    (error) => {
      assert.ok(error instanceof ContentValidationError);
      assert.equal(error.issues[0].code, "invalid_lifecycle_transition");
      return true;
    },
  );
  assert.equal(repositoryCalls, 0);
});

test("protects Draft queries and passes structured filters", async () => {
  let listFilters;
  const expectedDraft = draftRevision();
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getDraftById: async (revisionId) => {
        assert.equal(revisionId, expectedDraft.revisionId);
        return expectedDraft;
      },
      listDrafts: async (filters) => {
        listFilters = filters;
        return [expectedDraft];
      },
    }),
  });

  assert.equal(
    await service.getDraftById(expectedDraft.revisionId),
    expectedDraft,
  );
  assert.deepEqual(
    await service.listDrafts({ region: "Garden", growthStage: "Seed" }),
    [expectedDraft],
  );
  assert.deepEqual(listFilters, { region: "Garden", growthStage: "Seed" });

  let repositoryCalls = 0;
  const deniedService = createAdminContentService({
    authorize: async () => {
      throw new GardenKeeperRequiredError();
    },
    repository: repositoryStub({
      getDraftById: async () => {
        repositoryCalls += 1;
      },
      listDrafts: async () => {
        repositoryCalls += 1;
      },
    }),
  });

  await assert.rejects(
    deniedService.getDraftById("revision-id"),
    GardenKeeperRequiredError,
  );
  await assert.rejects(
    deniedService.listDrafts(),
    GardenKeeperRequiredError,
  );
  assert.equal(repositoryCalls, 0);
});

test("Atomic publishing migration uses one locked, narrow publish function", () => {
  const migration = fs.readFileSync(atomicPublishingMigrationPath, "utf8");
  const functionStart = migration.search(
    /create(?: or replace)? function public\.publish_review_revision/i,
  );
  const functionEnd = migration.indexOf(
    "comment on function public.publish_review_revision",
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.ok(functionEnd > functionStart);
  const publishFunction = migration.slice(functionStart, functionEnd);

  assert.match(publishFunction, /security definer/i);
  assert.match(publishFunction, /private\.is_garden_keeper\(\)/i);
  assert.match(publishFunction, /for update/i);
  assert.match(publishFunction, /update\s+public\.contents/i);
  assert.match(publishFunction, /insert into\s+public\.content_versions/i);
  assert.match(publishFunction, /delete from\s+public\.content_revisions/i);
  assert.ok(
    publishFunction.search(/insert into\s+public\.content_versions/i) <
      publishFunction.search(/delete from\s+public\.content_revisions/i),
  );
  assert.match(publishFunction, /source_revision_id/i);
  assert.match(publishFunction, /source_lock_version/i);
  assert.match(
    migration,
    /revoke\s+update(?:\s*,\s*delete)?\s+on(?:\s+table)?\s+public\.contents\s+from\s+authenticated/i,
  );
  assert.match(
    migration,
    /revoke\s+insert\s+on(?:\s+table)?\s+public\.content_versions\s+from\s+authenticated/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.publish_review_revision[\s\S]*?to\s+authenticated/i,
  );
});

test("Growth Stage schema migration permits only nullable Lake Reflections", () => {
  const migration = fs.readFileSync(
    growthStageApplicabilityMigrationPath,
    "utf8",
  );
  assert.match(
    migration,
    /alter table public\.contents\s+alter column growth_stage drop not null/i,
  );
  assert.match(
    migration,
    /alter table public\.content_revisions\s+alter column growth_stage drop not null/i,
  );
  assert.match(
    migration,
    /growth_stage is not null\s+or \(region = 'Lake' and content_type = 'Reflection'\)/i,
  );
  assert.match(migration, /validate constraint contents_growth_stage_applicability/i);
  assert.match(
    migration,
    /validate constraint content_revisions_growth_stage_applicability/i,
  );
  assert.match(migration, /revision\.growth_stage is not null/i);
  assert.match(migration, /execute_v1_import Lake resolution patch/i);
  assert.doesNotMatch(migration, /alter type public\.growth_stage/i);
});

test("Growth Stage schema sync safely reapplies nullable Lake Reflection constraints", () => {
  const migration = fs.readFileSync(
    growthStageApplicabilitySyncMigrationPath,
    "utf8",
  );
  assert.match(migration, /^begin;/i);
  assert.match(migration, /commit;\s*$/i);
  assert.match(
    migration,
    /alter table public\.contents\s+alter column growth_stage drop not null/i,
  );
  assert.match(
    migration,
    /alter table public\.content_revisions\s+alter column growth_stage drop not null/i,
  );
  assert.match(
    migration,
    /drop constraint if exists contents_growth_stage_applicability/i,
  );
  assert.match(
    migration,
    /drop constraint if exists content_revisions_growth_stage_applicability/i,
  );
  assert.equal(
    migration.match(
      /growth_stage is not null\s+or \(region = 'Lake' and content_type = 'Reflection'\)/gi,
    )?.length,
    2,
  );
  assert.match(
    migration,
    /add constraint contents_growth_stage_applicability check[\s\S]*?not valid/i,
  );
  assert.match(
    migration,
    /add constraint content_revisions_growth_stage_applicability check[\s\S]*?not valid/i,
  );
  assert.match(
    migration,
    /validate constraint contents_growth_stage_applicability/i,
  );
  assert.match(
    migration,
    /validate constraint content_revisions_growth_stage_applicability/i,
  );
  assert.doesNotMatch(migration, /growth_notes|from_stage|to_stage/i);
  assert.doesNotMatch(migration, /alter type public\.growth_stage/i);
});

test("Draft clone migration preserves source history and never writes Published data", () => {
  const migration = fs.readFileSync(draftManagementMigrationPath, "utf8");
  const functionStart = migration.indexOf(
    "create or replace function public.start_content_draft_revision",
  );
  const functionEnd = migration.indexOf(
    "comment on function public.start_content_draft_revision",
    functionStart,
  );
  const cloneFunction = migration.slice(functionStart, functionEnd);

  assert.match(cloneFunction, /from public\.content_versions as version/);
  assert.match(cloneFunction, /source_version_id/);
  assert.match(cloneFunction, /insert into public\.content_revisions/);
  assert.doesNotMatch(cloneFunction, /update\s+public\.contents/i);
  assert.doesNotMatch(cloneFunction, /insert into\s+public\.content_versions/i);
  assert.doesNotMatch(cloneFunction, /delete\s+from\s+public\.contents/i);
});

test("Review migration records workflow actors and enforces immutability only in revisions", () => {
  const migration = fs.readFileSync(reviewWorkflowMigrationPath, "utf8");

  assert.match(migration, /review_submitted_at/);
  assert.match(migration, /review_submitted_by/);
  assert.match(migration, /returned_to_draft_at/);
  assert.match(migration, /returned_to_draft_by/);
  assert.match(migration, /review_revision_read_only/);
  assert.match(migration, /new\.lock_version = old\.lock_version \+ 1/);
  assert.doesNotMatch(migration, /update\s+public\.contents/i);
  assert.doesNotMatch(migration, /insert into\s+public\.content_versions/i);
});

test("publish repository calls the narrow RPC and returns a serializable receipt", async () => {
  const input = {
    contentId: "content-id",
    revisionId: "revision-id",
    expectedLockVersion: 4,
  };
  const expected = publicationReceipt();
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "publish_review_revision");
      assert.deepEqual(args, {
        p_content_id: input.contentId,
        p_revision_id: input.revisionId,
        p_expected_lock_version: input.expectedLockVersion,
      });
      return { data: expected, error: null };
    },
  };
  const repository = createContentWriteRepository(client);

  const result = await repository.publishReview(input);

  assert.deepEqual(result, expected);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
});

test("maps publish serialization conflicts to a typed revision conflict", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: { code: "40001", message: "revision_conflict" },
    }),
  };
  const repository = createContentWriteRepository(client);

  await assert.rejects(
    repository.publishReview({
      contentId: "content-id",
      revisionId: "revision-id",
      expectedLockVersion: 4,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "revision_conflict");
      assert.equal(error.operation, "publishReview");
      return true;
    },
  );
});

test("maps denied publish RPC errors without exposing database details", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: {
        code: "42501",
        message: "private authorization policy and table detail",
      },
    }),
  };
  const repository = createContentWriteRepository(client);

  await assert.rejects(
    repository.publishReview({
      contentId: "content-id",
      revisionId: "revision-id",
      expectedLockVersion: 4,
    }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "mutation_denied");
      assert.equal(error.operation, "publishReview");
      assert.doesNotMatch(error.message, /private|policy|table detail/i);
      return true;
    },
  );
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

test("Keeper archives Published content through the narrow archive repository", async () => {
  const input = archiveInput();
  const expected = archiveReceipt();
  const received = [];
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub(),
    archiveRepository: {
      archivePublishedContent: async (archiveRequest) => {
        received.push(archiveRequest);
        return expected;
      },
    },
  });

  assert.deepEqual(await service.archiveContent(input), expected);
  assert.deepEqual(await service.archiveContent(input), expected);
  assert.deepEqual(received, [input, input]);
});

test("archive service rejects invalid identities and concurrency tokens before RPC access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub(),
    archiveRepository: {
      archivePublishedContent: async () => {
        repositoryCalls += 1;
      },
    },
  });

  const cases = [
    [
      archiveInput({ contentId: "" }),
      "invalid_content_identity",
    ],
    [
      archiveInput({ operationId: "not-an-operation-id" }),
      "invalid_operation_id",
    ],
    [
      archiveInput({ expectedUpdatedAt: "not-a-timestamp" }),
      "invalid_concurrency_token",
    ],
  ];

  for (const [input, expectedCode] of cases) {
    await assert.rejects(service.archiveContent(input), (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, expectedCode);
      assert.equal(error.operation, "archiveContent");
      return true;
    });
  }

  assert.equal(repositoryCalls, 0);
});

test("archive service is disabled while the content source is legacy", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "legacy",
    repository: repositoryStub(),
    archiveRepository: {
      archivePublishedContent: async () => {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(service.archiveContent(archiveInput()), (error) => {
    assert.ok(error instanceof ContentMutationError);
    assert.equal(error.code, "archiving_disabled");
    assert.equal(error.operation, "archiveContent");
    return true;
  });
  assert.equal(repositoryCalls, 0);
});

test("archive repository calls the RPC and returns a serializable receipt", async () => {
  const input = archiveInput();
  const expected = archiveReceipt();
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "archive_published_content");
      assert.deepEqual(args, {
        p_content_id: input.contentId,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_operation_id: input.operationId,
      });
      return { data: expected, error: null };
    },
  };
  const repository = createArchiveRepository(client);

  const result = await repository.archivePublishedContent(input);

  assert.deepEqual(result, expected);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
});

test("archive repository maps lifecycle, workspace, retry-key, and stale-write errors", async () => {
  const cases = [
    [
      { code: "P0002", message: "content_not_found" },
      "content_not_found",
    ],
    [
      { code: "22023", message: "archive_lifecycle_conflict" },
      "archive_lifecycle_conflict",
    ],
    [
      { code: "55000", message: "active_editorial_workspace" },
      "active_editorial_workspace",
    ],
    [
      { code: "40001", message: "archive_conflict" },
      "archive_conflict",
    ],
    [
      { code: "40001", message: "archive_operation_conflict" },
      "archive_operation_conflict",
    ],
  ];

  for (const [databaseError, expectedCode] of cases) {
    const repository = createArchiveRepository({
      rpc: async () => ({ data: null, error: databaseError }),
    });

    await assert.rejects(
      repository.archivePublishedContent(archiveInput()),
      (error) => {
        assert.ok(error instanceof ContentMutationError);
        assert.equal(error.code, expectedCode);
        assert.equal(error.operation, "archiveContent");
        assert.doesNotMatch(error.message, /public\.|content_versions|sql/i);
        return true;
      },
    );
  }
});

test("Archive migration exposes one atomic Keeper-only workflow", () => {
  const migration = fs.readFileSync(archiveFoundationMigrationPath, "utf8");
  const functionStart = migration.search(
    /create function public\.archive_published_content/i,
  );
  const functionEnd = migration.indexOf(
    "comment on function public.archive_published_content",
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.ok(functionEnd > functionStart);
  const archiveFunction = migration.slice(functionStart, functionEnd);
  const projectionUpdate = archiveFunction.match(
    /update public\.contents as projection[\s\S]*?where projection\.id = p_content_id;/i,
  )?.[0];

  assert.match(archiveFunction, /security definer/i);
  assert.match(archiveFunction, /private\.is_garden_keeper\(\)/i);
  assert.match(archiveFunction, /for update/i);
  assert.match(archiveFunction, /content\.lifecycle <> 'Published'/i);
  assert.match(archiveFunction, /active_editorial_workspace/i);
  assert.match(archiveFunction, /insert into public\.content_versions/i);
  assert.match(archiveFunction, /checkpoint_reason[\s\S]*?'Archived'/i);
  assert.match(archiveFunction, /archive_operation_id/i);
  assert.match(archiveFunction, /delete from public\.home_curation/i);
  assert.ok(
    archiveFunction.search(/insert into public\.content_versions/i) <
      archiveFunction.search(/update public\.contents as projection/i),
  );
  assert.ok(projectionUpdate);
  assert.match(projectionUpdate, /lifecycle = 'Archived'/i);
  assert.match(projectionUpdate, /archived_at = archive_time/i);
  assert.match(projectionUpdate, /archived_by = actor_id/i);
  assert.doesNotMatch(
    projectionUpdate,
    /body_|slug\s*=|region\s*=|published_at\s*=/i,
  );
  assert.doesNotMatch(
    archiveFunction,
    /delete from public\.(?:growth_notes|content_relations|content_tags)/i,
  );
  assert.doesNotMatch(archiveFunction, /(?:delete|update)\s+storage\./i);
  assert.match(
    migration,
    /create unique index content_versions_archive_receipt_idx/i,
  );
  assert.match(
    migration,
    /revoke update\s*,\s*delete on table public\.contents from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.archive_published_content[\s\S]*?to authenticated/i,
  );
});

test("Keeper restores an immutable version through the narrow restore repository", async () => {
  const input = restoreInput();
  const expected = restoreReceipt();
  const received = [];
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub(),
    restoreRepository: {
      restoreVersionToDraft: async (restoreRequest) => {
        received.push(restoreRequest);
        return expected;
      },
    },
  });

  assert.deepEqual(await service.restoreVersionToDraft(input), expected);
  assert.deepEqual(await service.restoreVersionToDraft(input), expected);
  assert.deepEqual(received, [input, input]);
});

test("restore service rejects invalid identities and concurrency tokens before RPC access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    repository: repositoryStub(),
    restoreRepository: {
      restoreVersionToDraft: async () => {
        repositoryCalls += 1;
      },
    },
  });
  const cases = [
    [restoreInput({ contentId: "" }), "invalid_content_identity"],
    [
      restoreInput({ sourceVersionId: "not-a-version-id" }),
      "restore_version_invalid",
    ],
    [
      restoreInput({ operationId: "not-an-operation-id" }),
      "invalid_operation_id",
    ],
    [
      restoreInput({ expectedArchivedToken: "not-a-timestamp" }),
      "invalid_concurrency_token",
    ],
  ];

  for (const [input, expectedCode] of cases) {
    await assert.rejects(service.restoreVersionToDraft(input), (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, expectedCode);
      assert.equal(error.operation, "restoreVersionToDraft");
      return true;
    });
  }

  assert.equal(repositoryCalls, 0);
});

test("restore service is disabled while the content source is legacy", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "legacy",
    repository: repositoryStub(),
    restoreRepository: {
      restoreVersionToDraft: async () => {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(
    service.restoreVersionToDraft(restoreInput()),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "restoring_disabled");
      assert.equal(error.operation, "restoreVersionToDraft");
      return true;
    },
  );
  assert.equal(repositoryCalls, 0);
});

test("restore repository calls the RPC and returns a serializable receipt", async () => {
  const input = restoreInput();
  const expected = restoreReceipt();
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "restore_version_to_draft");
      assert.deepEqual(args, {
        p_content_id: input.contentId,
        p_source_version_id: input.sourceVersionId,
        p_expected_archived_token: input.expectedArchivedToken,
        p_operation_id: input.operationId,
      });
      return { data: expected, error: null };
    },
  };
  const repository = createRestoreRepository(client);

  const result = await repository.restoreVersionToDraft(input);

  assert.deepEqual(result, expected);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
});

test("restore repository rejects a malformed receipt safely", async () => {
  const repository = createRestoreRepository({
    rpc: async () => ({
      data: restoreReceipt({ lockVersion: 0 }),
      error: null,
    }),
  });

  await assert.rejects(
    repository.restoreVersionToDraft(restoreInput()),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "repository_failure");
      assert.equal(error.operation, "restoreVersionToDraft");
      return true;
    },
  );
});

test("restore repository maps workflow and retry conflicts to typed errors", async () => {
  const cases = [
    [{ code: "P0002", message: "content_not_found" }, "content_not_found"],
    [
      { code: "22023", message: "restore_version_invalid" },
      "restore_version_invalid",
    ],
    [
      { code: "22023", message: "restore_lifecycle_conflict" },
      "restore_lifecycle_conflict",
    ],
    [
      { code: "22023", message: "restore_snapshot_invalid" },
      "restore_snapshot_invalid",
    ],
    [
      { code: "22023", message: "invalid_concurrency_token" },
      "invalid_concurrency_token",
    ],
    [
      { code: "22023", message: "invalid_operation_id" },
      "invalid_operation_id",
    ],
    [
      { code: "55000", message: "active_editorial_workspace" },
      "active_editorial_workspace",
    ],
    [
      { code: "55000", message: "active_restore_conflict" },
      "active_restore_conflict",
    ],
    [{ code: "40001", message: "restore_conflict" }, "restore_conflict"],
    [
      { code: "40001", message: "restore_operation_conflict" },
      "restore_operation_conflict",
    ],
    [{ code: "42501", message: "private policy detail" }, "mutation_denied"],
  ];

  for (const [databaseError, expectedCode] of cases) {
    const repository = createRestoreRepository({
      rpc: async () => ({ data: null, error: databaseError }),
    });

    await assert.rejects(
      repository.restoreVersionToDraft(restoreInput()),
      (error) => {
        assert.ok(error instanceof ContentMutationError);
        assert.equal(error.code, expectedCode);
        assert.equal(error.operation, "restoreVersionToDraft");
        assert.doesNotMatch(
          error.message,
          /private|policy|public\.|content_versions|sql/i,
        );
        return true;
      },
    );
  }
});

test("restore repository sanitizes unknown database errors", async () => {
  const repository = createRestoreRepository({
    rpc: async () => ({
      data: null,
      error: {
        code: "XX000",
        message: "private public.content_versions SQL failure",
      },
    }),
  });

  await assert.rejects(
    repository.restoreVersionToDraft(restoreInput()),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "repository_failure");
      assert.equal(error.operation, "restoreVersionToDraft");
      assert.doesNotMatch(
        error.message,
        /private|public\.|content_versions|sql/i,
      );
      return true;
    },
  );
});

test("Archived content cannot use the generic Draft clone path", async () => {
  let startCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    repository: repositoryStub({
      getContentWorkflowState: async () => ({
        contentId: restoreInput().contentId,
        lifecycle: "Archived",
      }),
      startDraftRevision: async () => {
        startCalls += 1;
      },
    }),
  });

  await assert.rejects(
    service.startDraftRevision({ contentId: restoreInput().contentId }),
    (error) => {
      assert.ok(error instanceof ContentValidationError);
      assert.equal(error.issues[0].code, "invalid_lifecycle_transition");
      return true;
    },
  );
  assert.equal(startCalls, 0);
});

test("Restore migration exposes one atomic Keeper-only workflow", () => {
  const migration = fs.readFileSync(restoreFoundationMigrationPath, "utf8");
  const functionStart = migration.search(
    /create function public\.restore_version_to_draft/i,
  );
  const functionEnd = migration.indexOf(
    "comment on function public.restore_version_to_draft",
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.ok(functionEnd > functionStart);
  const restoreFunction = migration.slice(functionStart, functionEnd);
  const checkpointInsert = restoreFunction.search(
    /insert into public\.content_versions/i,
  );
  const draftInsert = restoreFunction.search(
    /insert into public\.content_revisions/i,
  );
  const insertPolicyStart = migration.search(
    /create policy content_revisions_restore_insert_guard/i,
  );
  const insertPolicyEnd = migration.search(
    /create function private\.restore_snapshot_is_valid/i,
  );
  const insertPolicy = migration.slice(insertPolicyStart, insertPolicyEnd);
  const cloneFunctionStart = migration.search(
    /create or replace function public\.start_content_draft_revision/i,
  );
  const cloneFunctionEnd = migration.indexOf(
    "comment on function public.start_content_draft_revision",
    cloneFunctionStart,
  );
  const cloneFunction = migration.slice(cloneFunctionStart, cloneFunctionEnd);

  assert.match(restoreFunction, /security definer/i);
  assert.match(restoreFunction, /private\.is_garden_keeper\(\)/i);
  assert.match(
    restoreFunction,
    /from public\.contents[\s\S]*?for update/i,
  );
  assert.match(
    restoreFunction,
    /from public\.content_revisions[\s\S]*?for update/i,
  );
  assert.match(restoreFunction, /lifecycle\s*<>\s*'Archived'/i);
  assert.match(
    restoreFunction,
    /source_version\.content_id\s*<>\s*p_content_id/i,
  );
  assert.match(restoreFunction, /restore_snapshot_invalid/i);
  assert.match(restoreFunction, /checkpoint_reason[\s\S]*?'PreRestore'/i);
  assert.match(restoreFunction, /restore_operation_id/i);
  assert.match(restoreFunction, /source_version_id/i);
  assert.match(restoreFunction, /restored_by/i);
  assert.match(restoreFunction, /restored_at/i);
  assert.ok(checkpointInsert >= 0);
  assert.ok(draftInsert > checkpointInsert);
  assert.doesNotMatch(restoreFunction, /update\s+public\.contents/i);
  assert.doesNotMatch(
    restoreFunction,
    /(?:update|delete)\s+(?:from\s+)?public\.content_versions/i,
  );
  assert.doesNotMatch(
    restoreFunction,
    /(?:insert\s+into|update|delete\s+from)\s+public\.(?:content_relations|growth_notes|home_curation|content_tags|tags)/i,
  );
  assert.doesNotMatch(restoreFunction, /storage\./i);
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.match(
    migration,
    /create unique index content_versions_restore_receipt_idx/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.restore_version_to_draft[\s\S]*?to authenticated/i,
  );
  assert.notEqual(insertPolicyStart, -1);
  assert.ok(insertPolicyEnd > insertPolicyStart);
  assert.match(insertPolicy, /as restrictive/i);
  assert.match(insertPolicy, /for insert/i);
  assert.match(insertPolicy, /restore_operation_id\s+is\s+null/i);
  assert.match(
    insertPolicy,
    /parent_content\.lifecycle\s+in\s*\(\s*'Draft'\s*,\s*'Published'\s*\)/i,
  );
  assert.doesNotMatch(insertPolicy, /'Archived'/i);
  assert.notEqual(cloneFunctionStart, -1);
  assert.ok(cloneFunctionEnd > cloneFunctionStart);
  assert.match(cloneFunction, /lifecycle\s*<>\s*'Published'/i);
  assert.doesNotMatch(cloneFunction, /'Archived'/i);
});

test("Keeper previews impact and deletes Archived content through the narrow repository", async () => {
  const previewInput = { contentId: deleteInput().contentId };
  const deleteRequest = deleteInput();
  const preview = deletionImpactPreview();
  const receipt = deletionReceipt();
  const received = [];
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    deletionRepository: {
      previewDeletionImpact: async (input) => {
        received.push(["preview", input]);
        return preview;
      },
      deleteArchivedContent: async (input) => {
        received.push(["delete", input]);
        return receipt;
      },
    },
  });

  assert.deepEqual(await service.previewDeletionImpact(previewInput), preview);
  assert.deepEqual(await service.deleteArchivedContent(deleteRequest), receipt);
  assert.deepEqual(received, [
    ["preview", previewInput],
    ["delete", deleteRequest],
  ]);
});

test("deletion service validates confirmation inputs before repository access", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "database",
    deletionRepository: {
      previewDeletionImpact: async () => {
        repositoryCalls += 1;
      },
      deleteArchivedContent: async () => {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(
    service.previewDeletionImpact({ contentId: "not-a-content-id" }),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "invalid_content_identity");
      assert.equal(error.operation, "previewDeletionImpact");
      return true;
    },
  );

  const cases = [
    [deleteInput({ contentId: "" }), "invalid_content_identity"],
    [deleteInput({ operationId: "not-an-operation-id" }), "invalid_operation_id"],
    [deleteInput({ expectedArchivedToken: "not-a-timestamp" }), "invalid_concurrency_token"],
    [deleteInput({ impactDigest: "client-impact-json" }), "impact_digest_invalid"],
  ];

  for (const [input, expectedCode] of cases) {
    await assert.rejects(service.deleteArchivedContent(input), (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, expectedCode);
      assert.equal(error.operation, "deleteArchivedContent");
      return true;
    });
  }

  assert.equal(repositoryCalls, 0);
});

test("deletion preview and command are disabled for the legacy source", async () => {
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => keeper,
    sourceMode: "legacy",
    deletionRepository: {
      previewDeletionImpact: async () => {
        repositoryCalls += 1;
      },
      deleteArchivedContent: async () => {
        repositoryCalls += 1;
      },
    },
  });

  for (const [attempt, operation] of [
    [
      () => service.previewDeletionImpact({ contentId: deleteInput().contentId }),
      "previewDeletionImpact",
    ],
    [() => service.deleteArchivedContent(deleteInput()), "deleteArchivedContent"],
  ]) {
    await assert.rejects(attempt(), (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "deletion_disabled");
      assert.equal(error.operation, operation);
      return true;
    });
  }

  assert.equal(repositoryCalls, 0);
});

test("deletion repository calls only server-owned preview and delete RPCs", async () => {
  const preview = deletionImpactPreview();
  const receipt = deletionReceipt();
  const input = deleteInput();
  const calls = [];
  const repository = createDeletionRepository({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return name === "preview_archived_content_deletion"
        ? { data: preview, error: null }
        : { data: receipt, error: null };
    },
  });

  assert.deepEqual(
    await repository.previewDeletionImpact({ contentId: input.contentId }),
    preview,
  );
  assert.deepEqual(await repository.deleteArchivedContent(input), receipt);
  assert.deepEqual(calls, [
    [
      "preview_archived_content_deletion",
      { p_content_id: input.contentId },
    ],
    [
      "delete_archived_content",
      {
        p_content_id: input.contentId,
        p_expected_archived_token: input.expectedArchivedToken,
        p_impact_digest: input.impactDigest,
        p_operation_id: input.operationId,
      },
    ],
  ]);
});

test("deletion repository accepts typed already-completed receipts and rejects malformed data", async () => {
  const completed = deletionReceipt({ status: "already_completed" });
  const completedRepository = createDeletionRepository({
    rpc: async () => ({ data: completed, error: null }),
  });
  assert.deepEqual(
    await completedRepository.deleteArchivedContent(deleteInput()),
    completed,
  );

  const malformedRepository = createDeletionRepository({
    rpc: async () => ({
      data: deletionReceipt({
        tombstoneResult: { requestedCount: -1 },
      }),
      error: null,
    }),
  });
  await assert.rejects(
    malformedRepository.deleteArchivedContent(deleteInput()),
    (error) => {
      assert.ok(error instanceof ContentMutationError);
      assert.equal(error.code, "repository_failure");
      assert.equal(error.operation, "deleteArchivedContent");
      return true;
    },
  );
});

test("deletion repository maps lifecycle, digest, concurrency, relation, route, and retry errors", async () => {
  const cases = [
    [{ code: "P0002", message: "content_not_found" }, "content_not_found"],
    [{ code: "22023", message: "delete_lifecycle_conflict" }, "delete_lifecycle_conflict"],
    [{ code: "22023", message: "impact_digest_invalid" }, "impact_digest_invalid"],
    [{ code: "40001", message: "delete_conflict" }, "delete_conflict"],
    [{ code: "40001", message: "impact_digest_mismatch" }, "impact_digest_mismatch"],
    [{ code: "40001", message: "delete_operation_conflict" }, "delete_operation_conflict"],
    [{ code: "40001", message: "route_tombstone_incomplete" }, "route_tombstone_incomplete"],
    [{ code: "40001", message: "relation_cleanup_conflict" }, "relation_cleanup_conflict"],
    [{ code: "23505", message: "route_tombstone_conflict" }, "route_tombstone_conflict"],
    [{ code: "55000", message: "active_editorial_workspace" }, "active_editorial_workspace"],
    [{ code: "42501", message: "private policy detail" }, "mutation_denied"],
  ];

  for (const [databaseError, expectedCode] of cases) {
    const repository = createDeletionRepository({
      rpc: async () => ({ data: null, error: databaseError }),
    });

    await assert.rejects(
      repository.deleteArchivedContent(deleteInput()),
      (error) => {
        assert.ok(error instanceof ContentMutationError);
        assert.equal(error.code, expectedCode);
        assert.equal(error.operation, "deleteArchivedContent");
        assert.doesNotMatch(
          error.message,
          /private|policy|public\.|content_versions|route_redirects|sql/i,
        );
        return true;
      },
    );
  }
});

test("Delete safety migration preserves history and orders one atomic terminal workflow", () => {
  const migration = fs.readFileSync(deleteSafetyMigrationPath, "utf8");
  const functionStart = migration.search(
    /create function public\.delete_archived_content/i,
  );
  const functionEnd = migration.indexOf(
    "comment on function public.delete_archived_content",
    functionStart,
  );

  assert.notEqual(functionStart, -1);
  assert.ok(functionEnd > functionStart);
  const deleteFunction = migration.slice(functionStart, functionEnd);
  const tombstoneWrite = deleteFunction.search(
    /update public\.route_redirects as redirect/i,
  );
  const relationDelete = deleteFunction.search(
    /delete from public\.content_relations/i,
  );
  const receiptInsert = deleteFunction.search(
    /insert into public\.content_deletion_receipts/i,
  );
  const projectionDelete = deleteFunction.search(
    /delete from public\.contents as projection/i,
  );

  assert.match(migration, /create function public\.preview_archived_content_deletion/i);
  assert.match(deleteFunction, /security definer/i);
  assert.match(deleteFunction, /private\.is_garden_keeper\(\)/i);
  assert.match(deleteFunction, /from public\.contents[\s\S]*?for update/i);
  assert.match(deleteFunction, /content\.lifecycle <> 'Archived'/i);
  assert.match(deleteFunction, /active_editorial_workspace/i);
  assert.match(deleteFunction, /impact_digest_mismatch/i);
  assert.match(deleteFunction, /already_completed/i);
  assert.ok(tombstoneWrite >= 0);
  assert.ok(relationDelete > tombstoneWrite);
  assert.ok(receiptInsert > relationDelete);
  assert.ok(projectionDelete > receiptInsert);
  assert.doesNotMatch(
    deleteFunction,
    /(?:update|delete\s+from)\s+public\.content_versions/i,
  );
  assert.doesNotMatch(deleteFunction, /(?:delete|update)\s+(?:from\s+)?storage\./i);
  assert.match(
    migration,
    /alter table public\.content_versions\s+drop constraint content_versions_content_id_fkey/i,
  );
  assert.match(migration, /create table public\.content_deletion_receipts/i);
  assert.match(migration, /tombstone_original_content_id uuid/i);
  assert.match(migration, /tombstone_operation_id uuid/i);
  assert.match(migration, /tombstoned_at timestamptz/i);
  assert.match(
    migration,
    /revoke delete on table public\.contents from authenticated/i,
  );
  assert.match(
    migration,
    /revoke delete on table public\.route_redirects from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.delete_archived_content[\s\S]*?to authenticated/i,
  );
  assert.doesNotMatch(migration, /disable row level security/i);
});
