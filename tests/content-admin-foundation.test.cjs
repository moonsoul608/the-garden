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
