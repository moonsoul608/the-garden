import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const CALLBACK_ERROR_PATH = "/?auth_error=oauth_callback_failed";

function redirectResponse(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const redirectPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("next"),
  );

  if (!code) {
    return redirectResponse(request, CALLBACK_ERROR_PATH);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectResponse(request, CALLBACK_ERROR_PATH);
  }

  return redirectResponse(request, redirectPath);
}
