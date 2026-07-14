export type ContentValidationIssueCode =
  | "missing_title"
  | "missing_summary"
  | "missing_body"
  | "missing_slug"
  | "invalid_slug"
  | "missing_primary_category"
  | "missing_growth_stage"
  | "invalid_lifecycle_transition"
  | "missing_cover_path"
  | "orphaned_cover_alt"
  | "missing_cover_alt"
  | "self_relation"
  | "duplicate_relation"
  | "invalid_relation_note"
  | "unresolved_relation"
  | "unsupported_migration_relation"
  | "missing_growth_note"
  | "unchanged_growth_stage"
  | "duplicate_legacy_id"
  | "duplicate_route";

export type ContentValidationIssue = {
  code: ContentValidationIssueCode;
  message: string;
  field?: string;
  contentId?: string;
  legacyId?: string;
  severity: "error" | "blocked";
};

export type ContentValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: ContentValidationIssue[] };

export class ContentValidationError extends Error {
  readonly issues: ContentValidationIssue[];

  constructor(
    issues: ContentValidationIssue[],
    message = "Content validation failed.",
  ) {
    super(message);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

export type ContentServiceErrorCode =
  | "invalid_source_mode"
  | "repository_failure"
  | "mapping_failure"
  | "not_found";

export class ContentServiceError extends Error {
  readonly code: ContentServiceErrorCode;
  readonly operation?: string;

  constructor(
    code: ContentServiceErrorCode,
    message: string,
    operation?: string,
  ) {
    super(message);
    this.name = "ContentServiceError";
    this.code = code;
    this.operation = operation;
  }
}

export class ContentRepositoryError extends ContentServiceError {
  constructor(operation: string) {
    super(
      "repository_failure",
      "The content source could not complete the request.",
      operation,
    );
    this.name = "ContentRepositoryError";
  }
}

export class ContentMappingError extends ContentServiceError {
  constructor(field: string) {
    super(
      "mapping_failure",
      `Published content is missing the required ${field} field.`,
      "mapPublishedContent",
    );
    this.name = "ContentMappingError";
  }
}

export function assertContentValid(
  result: ContentValidationResult,
): asserts result is { valid: true; issues: [] } {
  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }
}
