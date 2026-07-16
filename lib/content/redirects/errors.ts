import "server-only";

export type RedirectErrorCode =
  | "invalid_source_route"
  | "invalid_target_route"
  | "invalid_redirect_type"
  | "invalid_redirect_reason"
  | "self_redirect"
  | "redirect_loop"
  | "redirect_chain"
  | "redirect_source_not_reserved"
  | "redirect_target_not_found"
  | "redirect_target_draft"
  | "redirect_target_review"
  | "redirect_target_deleted"
  | "redirect_conflict"
  | "redirect_mutation_denied"
  | "redirect_repository_failure";

const publicMessages: Record<RedirectErrorCode, string> = {
  invalid_source_route: "The redirect source route is invalid.",
  invalid_target_route: "The redirect target route is invalid.",
  invalid_redirect_type: "The redirect type is invalid.",
  invalid_redirect_reason: "The redirect reason is invalid.",
  self_redirect: "A route cannot redirect to itself.",
  redirect_loop: "The redirect would create a loop.",
  redirect_chain: "The redirect would create a chain.",
  redirect_source_not_reserved: "The redirect source route is not reserved.",
  redirect_target_not_found: "The redirect target route does not exist.",
  redirect_target_draft: "A redirect cannot target Draft content.",
  redirect_target_review: "A redirect cannot target Review content.",
  redirect_target_deleted: "A redirect cannot target deleted content.",
  redirect_conflict: "The redirect source already has a different redirect.",
  redirect_mutation_denied: "The redirect mutation was denied.",
  redirect_repository_failure: "The redirect could not be saved.",
};

export class RedirectError extends Error {
  constructor(readonly code: RedirectErrorCode) {
    super(publicMessages[code]);
    this.name = "RedirectError";
  }
}

type DatabaseErrorShape = {
  code?: unknown;
  message?: unknown;
};

export function mapRedirectDatabaseError(error: unknown): RedirectError {
  const databaseError =
    error && typeof error === "object"
      ? (error as DatabaseErrorShape)
      : null;
  const code =
    typeof databaseError?.code === "string" ? databaseError.code : "";
  const message =
    typeof databaseError?.message === "string" ? databaseError.message : "";
  if (code === "22023") {
    const mappedCode = new Set<RedirectErrorCode>([
      "invalid_source_route",
      "invalid_target_route",
      "invalid_redirect_type",
      "invalid_redirect_reason",
      "self_redirect",
      "redirect_target_draft",
      "redirect_target_review",
      "redirect_target_deleted",
    ]);
    if (mappedCode.has(message as RedirectErrorCode)) {
      return new RedirectError(message as RedirectErrorCode);
    }
  }

  if (
    code === "40001" &&
    (message === "redirect_loop" || message === "redirect_chain")
  ) {
    return new RedirectError(message);
  }

  if (
    (code === "P0002" || code === "02000") &&
    (message === "redirect_source_not_reserved" ||
      message === "redirect_target_not_found")
  ) {
    return new RedirectError(message);
  }

  if (code === "23505" && message === "redirect_conflict") {
    return new RedirectError("redirect_conflict");
  }

  if (code === "42501") return new RedirectError("redirect_mutation_denied");
  return new RedirectError("redirect_repository_failure");
}
