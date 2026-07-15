import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LogoutResult =
  | { ok: true }
  | { ok: false; error: "logout_failed" };

export async function logout(): Promise<LogoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  return error ? { ok: false, error: "logout_failed" } : { ok: true };
}
