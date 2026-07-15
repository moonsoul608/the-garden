"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function GitHubLoginButton() {
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function signInWithGitHub() {
    setIsPending(true);
    setHasError(false);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/admin");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setHasError(true);
        setIsPending(false);
      }
    } catch {
      setHasError(true);
      setIsPending(false);
    }
  }

  return (
    <div className="admin-login-control">
      <button
        className="admin-primary-action"
        type="button"
        onClick={signInWithGitHub}
        disabled={isPending}
      >
        {isPending ? "Opening GitHub…" : "Continue with GitHub"}
      </button>
      {hasError ? (
        <p className="admin-login-error" role="alert">
          Sign in could not be started. Please try again.
        </p>
      ) : null}
    </div>
  );
}
