import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const OAUTH_START_ERROR_PATH = "/?auth_error=oauth_start_failed";

function redirectResponse(request: NextRequest, path: string | URL) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

export async function GET(request: NextRequest) {
  const redirectPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("next"),
    "/admin",
  );
  const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
  callbackUrl.searchParams.set("next", redirectPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    return redirectResponse(request, OAUTH_START_ERROR_PATH);
  }

  return redirectResponse(request, data.url);
}
