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
  | "archive_lifecycle_conflict"
  | "active_editorial_workspace"
  | "archive_conflict"
  | "archive_operation_conflict"
  | "invalid_operation_id"
  | "mutation_denied"
  | "invalid_concurrency_token"
  | "repository_failure";

export type ContentMutationOperation =
  | "createDraft"
  | "getDraftById"
  | "listDrafts"
  | "readContentWorkflow"
  | "readDraftRevision"
  | "updateDraft"
  | "prepareReview"
  | "submitForReview"
  | "returnToDraft"
  | "publishReview"
  | "archiveContent"
  | "startDraftRevision";

const publicMessages: Record<ContentMutationErrorCode, string> = {
  content_not_found: "The content item could not be found.",
  revision_not_found: "The Draft revision could not be found.",
  revision_conflict: "The Draft changed after this edit began.",
  revision_not_editable: "This revision is read-only.",
  invalid_revision_state: "The revision is not in the required workflow state.",
  invalid_content_state: "The content item is not in a publishable state.",
  invalid_content_identity: "The content identity is invalid.",
  revision_already_exists: "This content item already has an active revision.",
  slug_conflict: "That Region and slug are already in use.",
  immutable_slug: "The published slug cannot be changed.",
  immutable_region: "The published Region cannot be changed.",
  publication_validation_failed: "The Review no longer passes publication validation.",
  publishing_disabled: "Publishing is disabled for the current content source mode.",
  archiving_disabled: "Archiving is disabled for the current content source mode.",
  archive_lifecycle_conflict: "Only Published content can be archived.",
  active_editorial_workspace: "This content item has an active editorial workspace.",
  archive_conflict: "The Published content changed before it could be archived.",
  archive_operation_conflict: "The archive operation identifier is already in use.",
  invalid_operation_id: "The archive operation identifier is invalid.",
  mutation_denied: "The content mutation was denied.",
  invalid_concurrency_token: "The concurrency token is invalid.",
  repository_failure: "The content mutation could not be completed.",
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
