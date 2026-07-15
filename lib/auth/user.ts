import "server-only";

import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthenticatedUser = Readonly<{
  id: string;
}>;

export class AuthenticationRequiredError extends Error {
  readonly code = "authentication_required";

  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims.sub;

  if (
    error ||
    typeof subject !== "string" ||
    !UUID_PATTERN.test(subject) ||
    data?.claims.is_anonymous === true
  ) {
    return null;
  }

  return { id: subject };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}
