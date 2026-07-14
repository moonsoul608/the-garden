type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

function configurationError(detail: string) {
  return new Error(`Supabase is not configured: ${detail}`);
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

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

  try {
    const projectUrl = new URL(url!);

    if (projectUrl.protocol !== "https:" && projectUrl.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw configurationError(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.",
    );
  }

  return {
    url: url!,
    publishableKey: publishableKey!,
  };
}
