type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

type SupabasePublicEnvironment = Partial<
  Record<
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    string
  >
>;

function configurationError(detail: string) {
  return new Error(`Supabase is not configured: ${detail}`);
}

export function getSupabasePublicConfig(
  environment: SupabasePublicEnvironment =
    process.env as unknown as SupabasePublicEnvironment,
): SupabasePublicConfig {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  const missingVariables: string[] = [];

  if (!url) {
    missingVariables.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!publishableKey) {
    missingVariables.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missingVariables.length > 0) {
    throw configurationError(
      `set ${missingVariables.join(" and ")} for this environment.`,
    );
  }

  let projectUrl: URL;
  try {
    projectUrl = new URL(url!);

    if (projectUrl.protocol !== "https:" && projectUrl.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw configurationError(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.",
    );
  }

  if (
    projectUrl.pathname === "/rest/v1" ||
    projectUrl.pathname === "/rest/v1/"
  ) {
    projectUrl.pathname = "/";
  }
  if (
    projectUrl.pathname !== "/" ||
    projectUrl.search ||
    projectUrl.hash
  ) {
    throw configurationError(
      "NEXT_PUBLIC_SUPABASE_URL must be a project base URL or its /rest/v1 endpoint.",
    );
  }

  return {
    url: projectUrl.origin,
    publishableKey: publishableKey!,
  };
}
