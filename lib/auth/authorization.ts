import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
  type AuthenticatedUser,
} from "./user";

export type GardenKeeperAuthorizationResult =
  | { authorized: true; user: AuthenticatedUser }
  | {
      authorized: false;
      reason: "unauthenticated" | "forbidden" | "authorization_unavailable";
    };

export async function requireGardenKeeper(): Promise<GardenKeeperAuthorizationResult> {
  let user: AuthenticatedUser;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    return {
      authorized: false,
      reason:
        error instanceof AuthenticationRequiredError
          ? "unauthenticated"
          : "authorization_unavailable",
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "current_user_is_garden_keeper",
    );

    if (error) {
      return { authorized: false, reason: "authorization_unavailable" };
    }

    return data === true
      ? { authorized: true, user }
      : { authorized: false, reason: "forbidden" };
  } catch {
    return { authorized: false, reason: "authorization_unavailable" };
  }
}
