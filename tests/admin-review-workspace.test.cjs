/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const workspaceServicePath = path.join(
  projectRoot,
  "lib/content/admin/review-workspace-service.ts",
);
const adminServicePath = path.join(projectRoot, "lib/content/admin/service.ts");
const handlersPath = path.join(
  projectRoot,
  "app/admin/(protected)/review/action-handlers.ts",
);
const queuePagePath = path.join(
  projectRoot,
  "app/admin/(protected)/review/page.tsx",
);
const detailPagePath = path.join(
  projectRoot,
  "app/admin/(protected)/review/[revisionId]/page.tsx",
);
const actionsPath = path.join(
  projectRoot,
  "app/admin/(protected)/review/actions.ts",
);
const actionPanelPath = path.join(
  projectRoot,
  "app/admin/(protected)/review/review-action-panel.tsx",
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

Module._load = function loadWithReviewMocks(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/auth") {
    return {
      requireGardenKeeper: async () => ({
        id: "00000000-0000-4000-8000-000000005c01",
      }),
    };
  }
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        throw new Error("Tests must inject the review repository.");
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
  createReviewWorkspaceService,
  mapReviewChecklist,
} = require(workspaceServicePath);
const { createAdminContentService } = require(adminServicePath);
const { createReviewActionHandlers } = require(handlersPath);
const { ContentMutationError } = require(path.join(
  projectRoot,
  "lib/content/admin/errors.ts",
));

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});

function reviewRevision(overrides = {}) {
  return {
    contentId: "00000000-0000-4000-8000-000000005c11",
    revisionId: "00000000-0000-4000-8000-000000005c12",
    lifecycle: "Review",
    lockVersion: 4,
    sourceVersionId: null,
    baseContentUpdatedAt: null,
    reviewSubmittedAt: "2026-07-16T10:00:00.000Z",
    returnedToDraftAt: null,
    slug: "a-careful-review",
    region: "Garden",
    contentType: "Seed",
    detailLevel: "short",
    growthStage: "Sprout",
    titleZh: null,
    titleEn: "A careful Review",
    summaryZh: null,
    summaryEn: "A small note ready for checking.",
    bodyZhMarkdown: null,
    bodyEnMarkdown: "A complete short body.",
    contentLanguage: "en",
    primaryCategories: ["Coding"],
    tags: ["tending"],
    cover: null,
    featured: false,
    manualOrder: null,
    createdAt: "2026-07-16T08:00:00.000Z",
    updatedAt: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}

function readinessReport(overrides = {}) {
  return {
    ready: true,
    normalizedCandidate: {
      slug: "a-careful-review",
      region: "Garden",
      contentType: "Seed",
      detailLevel: "short",
      growthStage: "Sprout",
      titleZh: null,
      titleEn: "A careful Review",
      summaryZh: null,
      summaryEn: "A small note ready for checking.",
      bodyZhMarkdown: null,
      bodyEnMarkdown: "A complete short body.",
      contentLanguage: "en",
      primaryCategories: ["Coding"],
      tags: ["tending"],
      cover: null,
      featured: false,
      manualOrder: null,
    },
    validationIssues: [],
    missingRequirements: [],
    slugConflicts: [],
    coverStatus: { state: "absent", path: null },
    growthStageConsistency: {
      publishedStage: null,
      candidateStage: "Sprout",
      changed: false,
      hasMatchingGrowthNote: true,
    },
    relationIssues: [],
    differenceFromPublished: { kind: "new", changedFields: [] },
    ...overrides,
  };
}

function idleState() {
  return {
    status: "idle",
    message: null,
    destination: null,
    publishedAt: null,
  };
}

function transitionFormData() {
  const formData = new FormData();
  formData.set("contentId", reviewRevision().contentId);
  formData.set("revisionId", reviewRevision().revisionId);
  formData.set("expectedLockVersion", "4");
  return formData;
}

test("blocks unauthorized review reads before repository access", async () => {
  const denied = new Error("garden_keeper_required");
  let repositoryCalls = 0;
  const service = createAdminContentService({
    authorize: async () => {
      throw denied;
    },
    repository: {
      listReviews: async () => {
        repositoryCalls += 1;
        return [];
      },
    },
  });

  await assert.rejects(service.listReviews(), (error) => error === denied);
  assert.equal(repositoryCalls, 0);
});

test("prepareReview inspects a submitted Review without running a transition", async () => {
  const revision = reviewRevision();
  let contextCalls = 0;
  const service = createAdminContentService({
    authorize: async () => ({
      id: "00000000-0000-4000-8000-000000005c01",
    }),
    repository: {
      getDraftRevision: async () => revision,
      getReviewPreparationContext: async () => {
        contextCalls += 1;
        return {
          publishedProjection: null,
          slugConflicts: [],
          growthNotes: [],
          relations: [],
          existingContentIds: [],
        };
      },
    },
  });

  const report = await service.prepareReview({
    contentId: revision.contentId,
    revisionId: revision.revisionId,
  });

  assert.equal(report.ready, true);
  assert.equal(revision.lifecycle, "Review");
  assert.equal(contextCalls, 1);
});

test("review queue loads submitted revisions and readiness through services", async () => {
  const calls = [];
  const workspace = createReviewWorkspaceService({
    listReviews: async () => {
      calls.push("listReviews");
      return [reviewRevision()];
    },
    prepareReview: async (input) => {
      calls.push(["prepareReview", input]);
      return readinessReport();
    },
    getReviewById: async () => null,
    getDraftById: async () => null,
  });

  const queue = await workspace.listReviewQueue();

  assert.equal(queue.length, 1);
  assert.equal(queue[0].title, "A careful Review");
  assert.equal(queue[0].submittedAt, "2026-07-16T10:00:00.000Z");
  assert.equal(queue[0].ready, true);
  assert.deepEqual(calls, [
    "listReviews",
    [
      "prepareReview",
      {
        contentId: reviewRevision().contentId,
        revisionId: reviewRevision().revisionId,
      },
    ],
  ]);
});

test("readiness mapping exposes every editorial checklist area", () => {
  const issue = {
    code: "slug_conflict",
    message: "That Region and slug are already in use.",
    severity: "error",
  };
  const checklist = mapReviewChecklist(
    readinessReport({
      ready: false,
      validationIssues: [issue],
      slugConflicts: [
        {
          contentId: "00000000-0000-4000-8000-000000005c21",
          lifecycle: "Published",
        },
      ],
      differenceFromPublished: {
        kind: "changed",
        changedFields: ["titleEn", "tags"],
      },
    }),
  );

  assert.deepEqual(
    checklist.map(({ key }) => key),
    [
      "validation",
      "taxonomy",
      "tags",
      "slug",
      "cover",
      "growth-notes",
      "relations",
      "published-differences",
    ],
  );
  assert.equal(checklist.find(({ key }) => key === "slug").state, "attention");
  assert.equal(
    checklist.find(({ key }) => key === "published-differences").state,
    "information",
  );
});

test("submit action prepares readiness before using submitForReview", async () => {
  const calls = [];
  const handlers = createReviewActionHandlers({
    prepareReview: async () => {
      calls.push("prepareReview");
      return readinessReport();
    },
    submitForReview: async (input) => {
      calls.push(["submitForReview", input]);
      return reviewRevision();
    },
    returnToDraft: async () => {
      throw new Error("not used");
    },
    publishReview: async () => {
      throw new Error("not used");
    },
  });

  const result = await handlers.submitForReview(
    idleState(),
    transitionFormData(),
  );

  assert.equal(result.status, "success");
  assert.equal(calls[0], "prepareReview");
  assert.equal(calls[1][0], "submitForReview");
  assert.equal(calls[1][1].expectedLockVersion, 4);
});

test("return to Draft requires a reason and sends no actor fields", async () => {
  let received;
  let calls = 0;
  const handlers = createReviewActionHandlers({
    prepareReview: async () => readinessReport(),
    submitForReview: async () => reviewRevision(),
    returnToDraft: async (input) => {
      calls += 1;
      received = input;
      return reviewRevision({ lifecycle: "Draft", lockVersion: 5 });
    },
    publishReview: async () => {
      throw new Error("not used");
    },
  });
  const missingReason = transitionFormData();

  assert.equal(
    (await handlers.returnToDraft(idleState(), missingReason)).status,
    "error",
  );
  assert.equal(calls, 0);

  const withReason = transitionFormData();
  withReason.set("reason", "The summary needs another careful pass.");
  const result = await handlers.returnToDraft(idleState(), withReason);

  assert.equal(result.status, "success");
  assert.equal(calls, 1);
  assert.equal(received.expectedLockVersion, 4);
  assert.equal(received.reason, undefined);
  assert.equal(received.actor, undefined);
});

test("publish confirmation handles idempotent success and safe failure", async () => {
  let publishCalls = 0;
  const successHandlers = createReviewActionHandlers({
    prepareReview: async () => readinessReport(),
    submitForReview: async () => reviewRevision(),
    returnToDraft: async () => reviewRevision(),
    publishReview: async () => {
      publishCalls += 1;
      return {
        contentId: reviewRevision().contentId,
        revisionId: reviewRevision().revisionId,
        versionId: "00000000-0000-4000-8000-000000005c31",
        sourceLockVersion: 4,
        publishedAt: "2026-07-16T11:00:00.000Z",
        publishedBy: "00000000-0000-4000-8000-000000005c01",
      };
    },
  });
  const confirmed = transitionFormData();
  confirmed.set("publishConfirmation", "confirmed");

  const success = await successHandlers.publishReview(idleState(), confirmed);
  assert.equal(success.status, "success");
  assert.match(success.message, /will not create another version/);
  assert.equal(publishCalls, 1);

  const failureHandlers = createReviewActionHandlers({
    prepareReview: async () => readinessReport(),
    submitForReview: async () => reviewRevision(),
    returnToDraft: async () => reviewRevision(),
    publishReview: async () => {
      throw new Error("private RPC and SQL details");
    },
  });
  const failure = await failureHandlers.publishReview(idleState(), confirmed);
  assert.equal(failure.status, "error");
  assert.doesNotMatch(failure.message, /private|rpc|sql/i);

  const staleHandlers = createReviewActionHandlers({
    prepareReview: async () => readinessReport(),
    submitForReview: async () => reviewRevision(),
    returnToDraft: async () => reviewRevision(),
    publishReview: async () => {
      throw new ContentMutationError("revision_conflict", "publishReview");
    },
  });
  const stale = await staleHandlers.publishReview(idleState(), confirmed);
  assert.equal(stale.status, "conflict");
  assert.match(stale.message, /Reload/);
});

test("review routes keep data and mutations behind server boundaries", () => {
  const queuePage = fs.readFileSync(queuePagePath, "utf8");
  const detailPage = fs.readFileSync(detailPagePath, "utf8");
  const actions = fs.readFileSync(actionsPath, "utf8");
  const panel = fs.readFileSync(actionPanelPath, "utf8");
  const layout = fs.readFileSync(protectedLayoutPath, "utf8");

  assert.match(layout, /await requireGardenKeeper\(\)/);
  assert.match(layout, /href="\/admin\/review"/);
  assert.doesNotMatch(queuePage, /["']use client["']/);
  assert.doesNotMatch(detailPage, /["']use client["']/);
  assert.doesNotMatch(queuePage + detailPage, /supabase|\.from\(|\.rpc\(/i);
  assert.match(queuePage, /await listReviewQueue\(\)/);
  assert.match(detailPage, /await getReviewWorkspaceDetail\(revisionId\)/);
  assert.match(actions, /createAdminContentService\(\)/);
  assert.doesNotMatch(actions, /supabase|\.from\(|\.rpc\(/i);
  assert.match(panel, /name="reason"/);
  assert.match(panel, /name="publishConfirmation"/);
  assert.doesNotMatch(panel, /publishedBy|createdBy|updatedBy|supabase|rpc/i);
});
