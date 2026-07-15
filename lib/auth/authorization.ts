import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getCurrentUser, type AuthenticatedUser } from "./user";

export type AuthorizationErrorCode =
  | "authentication_required"
  | "garden_keeper_required"
  | "authorization_unavailable";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly code: AuthorizationErrorCode,
    readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationRequiredError extends AuthorizationError {
  constructor() {
    super("Authentication is required.", "authentication_required", 401);
    this.name = "AuthenticationRequiredError";
  }
}

export class GardenKeeperRequiredError extends AuthorizationError {
  constructor() {
    super(
      "Garden Keeper authorization is required.",
      "garden_keeper_required",
      403,
    );
    this.name = "GardenKeeperRequiredError";
  }
}

export class AuthorizationUnavailableError extends AuthorizationError {
  constructor() {
    super(
      "Authorization is temporarily unavailable.",
      "authorization_unavailable",
      503,
    );
    this.name = "AuthorizationUnavailableError";
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  let user: AuthenticatedUser | null;

  try {
    user = await getCurrentUser();
  } catch {
    throw new AuthorizationUnavailableError();
  }

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export async function requireGardenKeeper(): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "current_user_is_garden_keeper",
    );

    if (error) {
      throw new AuthorizationUnavailableError();
    }

    if (data !== true) {
      throw new GardenKeeperRequiredError();
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new AuthorizationUnavailableError();
  }

  return user;
}
