import "server-only";

export type ContentMutationErrorCode =
  | "content_not_found"
  | "revision_not_found"
  | "revision_conflict"
  | "revision_already_exists"
  | "slug_conflict"
  | "mutation_denied"
  | "invalid_concurrency_token"
  | "repository_failure";

export type ContentMutationOperation =
  | "createDraft"
  | "readContentWorkflow"
  | "readDraftRevision"
  | "updateDraft"
  | "startDraftRevision";

const publicMessages: Record<ContentMutationErrorCode, string> = {
  content_not_found: "The content item could not be found.",
  revision_not_found: "The Draft revision could not be found.",
  revision_conflict: "The Draft changed after this edit began.",
  revision_already_exists: "This content item already has an active revision.",
  slug_conflict: "That Region and slug are already in use.",
  mutation_denied: "The content mutation was denied.",
  invalid_concurrency_token: "The Draft concurrency token is invalid.",
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

  if (code === "42501") {
    return new ContentMutationError("mutation_denied", operation);
  }

  if (code === "P0002" || code === "02000") {
    return new ContentMutationError("content_not_found", operation);
  }

  if (code === "23505") {
    return new ContentMutationError(
      operation === "startDraftRevision"
        ? "revision_already_exists"
        : "slug_conflict",
      operation,
    );
  }

  return new ContentMutationError("repository_failure", operation);
}
