import "server-only";

export type ContentMutationErrorCode =
  | "content_not_found"
  | "revision_not_found"
  | "revision_conflict"
  | "revision_not_editable"
  | "invalid_revision_state"
  | "invalid_content_state"
  | "invalid_content_identity"
  | "revision_already_exists"
  | "slug_conflict"
  | "immutable_slug"
  | "immutable_region"
  | "publication_validation_failed"
  | "publishing_disabled"
  | "archiving_disabled"
  | "restoring_disabled"
  | "deletion_disabled"
  | "archive_lifecycle_conflict"
  | "active_editorial_workspace"
  | "archive_conflict"
  | "archive_operation_conflict"
  | "restore_lifecycle_conflict"
  | "restore_version_invalid"
  | "restore_snapshot_invalid"
  | "restore_conflict"
  | "restore_operation_conflict"
  | "active_restore_conflict"
  | "delete_lifecycle_conflict"
  | "delete_conflict"
  | "impact_digest_invalid"
  | "impact_digest_mismatch"
  | "delete_operation_conflict"
  | "route_tombstone_conflict"
  | "route_tombstone_incomplete"
  | "relation_cleanup_conflict"
  | "invalid_operation_id"
  | "mutation_denied"
  | "invalid_concurrency_token"
  | "repository_failure";

export type ContentMutationOperation =
  | "createDraft"
  | "getDraftById"
  | "listDrafts"
  | "getReviewById"
  | "listReviews"
  | "readContentWorkflow"
  | "readDraftRevision"
  | "updateDraft"
  | "prepareReview"
  | "submitForReview"
  | "returnToDraft"
  | "publishReview"
  | "archiveContent"
  | "restoreVersionToDraft"
  | "previewDeletionImpact"
  | "deleteArchivedContent"
  | "startDraftRevision";

const publicMessages: Record<ContentMutationErrorCode, string> = {
  content_not_found: "找不到该内容。",
  revision_not_found: "找不到该草稿修订。",
  revision_conflict: "此草稿在编辑开始后发生了变更。",
  revision_not_editable: "此修订为只读。",
  invalid_revision_state: "此修订不在所需工作流状态。",
  invalid_content_state: "此内容不在可发布状态。",
  invalid_content_identity: "内容身份无效。",
  revision_already_exists: "此内容已有一个活跃修订。",
  slug_conflict: "该区域和 Slug 已被使用。",
  immutable_slug: "已发布 Slug 不能更改。",
  immutable_region: "已发布区域不能更改。",
  publication_validation_failed: "此审核项已不再通过发布校验。",
  publishing_disabled: "当前内容源模式已禁用发布。",
  archiving_disabled: "当前内容源模式已禁用归档。",
  restoring_disabled: "当前内容源模式已禁用恢复。",
  deletion_disabled: "当前内容源模式已禁用永久删除。",
  archive_lifecycle_conflict: "只有已发布内容可以归档。",
  active_editorial_workspace: "此内容已有活跃编辑工作区。",
  archive_conflict: "已发布内容在归档前发生了变更。",
  archive_operation_conflict: "归档操作标识符已被使用。",
  restore_lifecycle_conflict: "只有已归档内容可以恢复。",
  restore_version_invalid: "所选内容版本无法恢复。",
  restore_snapshot_invalid: "所选恢复快照无效。",
  restore_conflict: "已归档内容在恢复前发生了变更。",
  restore_operation_conflict: "恢复操作标识符已被使用。",
  active_restore_conflict: "此内容已有活跃恢复操作。",
  delete_lifecycle_conflict: "只有已归档内容可以永久删除。",
  delete_conflict: "已归档内容在删除前发生了变更。",
  impact_digest_invalid: "删除影响确认无效。",
  impact_digest_mismatch: "删除影响在确认后发生了变化。",
  delete_operation_conflict: "删除操作标识符已被使用。",
  route_tombstone_conflict: "终止路由记录与实时或无关路由冲突。",
  route_tombstone_incomplete: "并非所有公开路由都能设为终止状态。",
  relation_cleanup_conflict: "实时关系集合在删除期间发生了变更。",
  invalid_operation_id: "操作标识符无效。",
  mutation_denied: "内容变更被拒绝。",
  invalid_concurrency_token: "并发令牌无效。",
  repository_failure: "内容变更无法完成。",
};

export class ContentMutationError extends Error {
  constructor(
    readonly code: ContentMutationErrorCode,
    readonly operation: ContentMutationOperation,
  ) {
    super(publicMessages[code]);
    this.name = "ContentMutationError";
  }
}

type DatabaseErrorShape = {
  code?: unknown;
  message?: unknown;
};

export function mapContentMutationDatabaseError(
  error: unknown,
  operation: ContentMutationOperation,
): ContentMutationError {
  const databaseError =
    error && typeof error === "object"
      ? (error as DatabaseErrorShape)
      : null;
  const code = typeof databaseError?.code === "string" ? databaseError.code : "";
  const message =
    typeof databaseError?.message === "string" ? databaseError.message : "";

  if (operation === "publishReview") {
    if (code === "P0002" && message === "content_not_found") {
      return new ContentMutationError("content_not_found", operation);
    }

    if (code === "P0002" && message === "revision_not_found") {
      return new ContentMutationError("revision_not_found", operation);
    }

    if (code === "40001" && message === "revision_conflict") {
      return new ContentMutationError("revision_conflict", operation);
    }

    if (code === "22023") {
      const knownCode =
        message === "invalid_concurrency_token" ||
        message === "invalid_revision_state" ||
        message === "invalid_content_state" ||
        message === "immutable_slug" ||
        message === "immutable_region" ||
        message === "publication_validation_failed"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "23505" && message === "slug_conflict") {
      return new ContentMutationError("slug_conflict", operation);
    }
  }

  if (operation === "archiveContent") {
    if (code === "P0002" && message === "content_not_found") {
      return new ContentMutationError("content_not_found", operation);
    }

    if (code === "40001") {
      const knownCode =
        message === "archive_conflict" ||
        message === "archive_operation_conflict"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "22023") {
      const knownCode =
        message === "invalid_concurrency_token" ||
        message === "invalid_operation_id" ||
        message === "archive_lifecycle_conflict"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "55000" && message === "active_editorial_workspace") {
      return new ContentMutationError("active_editorial_workspace", operation);
    }
  }

  if (operation === "restoreVersionToDraft") {
    if (code === "P0002" && message === "content_not_found") {
      return new ContentMutationError("content_not_found", operation);
    }

    if (code === "P0002" && message === "restore_version_invalid") {
      return new ContentMutationError("restore_version_invalid", operation);
    }

    if (code === "40001") {
      const knownCode =
        message === "restore_conflict" ||
        message === "restore_operation_conflict" ||
        message === "active_restore_conflict"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "22023") {
      const knownCode =
        message === "invalid_concurrency_token" ||
        message === "invalid_operation_id" ||
        message === "restore_lifecycle_conflict" ||
        message === "restore_version_invalid" ||
        message === "restore_snapshot_invalid"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "55000") {
      const knownCode =
        message === "active_editorial_workspace" ||
        message === "active_restore_conflict"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }
  }

  if (
    operation === "previewDeletionImpact" ||
    operation === "deleteArchivedContent"
  ) {
    if (code === "P0002" && message === "content_not_found") {
      return new ContentMutationError("content_not_found", operation);
    }

    if (code === "22023") {
      const knownCode =
        message === "invalid_concurrency_token" ||
        message === "invalid_operation_id" ||
        message === "delete_lifecycle_conflict" ||
        message === "impact_digest_invalid"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "40001") {
      const knownCode =
        message === "delete_conflict" ||
        message === "impact_digest_mismatch" ||
        message === "delete_operation_conflict" ||
        message === "route_tombstone_incomplete" ||
        message === "relation_cleanup_conflict"
          ? message
          : null;

      if (knownCode) {
        return new ContentMutationError(knownCode, operation);
      }
    }

    if (code === "23505" && message === "route_tombstone_conflict") {
      return new ContentMutationError("route_tombstone_conflict", operation);
    }

    if (code === "55000" && message === "active_editorial_workspace") {
      return new ContentMutationError("active_editorial_workspace", operation);
    }
  }

  if (code === "42501") {
    return new ContentMutationError("mutation_denied", operation);
  }

  if (code === "P0002" || code === "02000") {
    return new ContentMutationError("content_not_found", operation);
  }

  if (code === "23505" && operation !== "publishReview") {
    return new ContentMutationError(
      operation === "startDraftRevision"
        ? "revision_already_exists"
        : "slug_conflict",
      operation,
    );
  }

  return new ContentMutationError("repository_failure", operation);
}
