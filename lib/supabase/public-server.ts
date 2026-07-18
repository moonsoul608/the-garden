import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { ContentDatabase } from "@/types/database";

/**
 * Anonymous, RLS-constrained client for public content reads. Unlike the
 * authenticated server client, it is safe to create outside a request and
 * does not depend on cookies during static parameter or sitemap generation.
 */
export function createPublicServerClient() {
  const { url, publishableKey } = getSupabasePublicConfig();

  return createClient<ContentDatabase>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
