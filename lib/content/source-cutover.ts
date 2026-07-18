import "server-only";

import type { RegionName } from "@/types";

import { ContentServiceError } from "./errors";
import type { ContentRepository } from "./repository";

export type ContentSourceMode = "legacy" | "dual" | "database";

export type ContentSourceTransition =
  | "legacy->dual"
  | "dual->database"
  | "database->dual"
  | "dual->legacy";

export type ContentSourceConfiguration = {
  mode: ContentSourceMode;
  previousMode: ContentSourceMode | null;
  transition: ContentSourceTransition | null;
};

export type PublicRouteProbe = {
  region: RegionName;
  slug: string;
};

export type DatabaseModeValidationProbes = {
  published: PublicRouteProbe;
  draft: PublicRouteProbe;
  review: PublicRouteProbe;
  archived: PublicRouteProbe;
};

export type SourceCutoverEnvironment = Partial<
  Record<
    | "CONTENT_SOURCE_MODE"
    | "CONTENT_SOURCE_PREVIOUS_MODE"
    | "CONTENT_SOURCE_MODE_CONFIRM"
    | "CONTENT_DATABASE_PUBLISHED_PROBE"
    | "CONTENT_DATABASE_DRAFT_PROBE"
    | "CONTENT_DATABASE_REVIEW_PROBE"
    | "CONTENT_DATABASE_ARCHIVED_PROBE",
    string
  >
>;

const MODES = new Set<ContentSourceMode>(["legacy", "dual", "database"]);
const REGIONS = new Map<string, RegionName>([
  ["garden", "Garden"],
  ["forest", "Forest"],
  ["lake", "Lake"],
  ["ruins", "Ruins"],
]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_TRANSITIONS = new Set<ContentSourceTransition>([
  "legacy->dual",
  "dual->database",
  "database->dual",
  "dual->legacy",
]);

function configurationError(message: string): never {
  throw new ContentServiceError(
    "invalid_source_configuration",
    message,
    "resolveContentSourceConfiguration",
  );
}

function parseMode(value: string | undefined, variable: string) {
  if (!value || !MODES.has(value as ContentSourceMode)) {
    configurationError(`${variable} must be legacy, dual, or database.`);
  }
  return value as ContentSourceMode;
}

/**
 * Source changes are deployment configuration, never runtime inference.
 * An absent mode intentionally retains the V1 legacy default.
 */
export function resolveContentSourceConfiguration(
  environment: SourceCutoverEnvironment = process.env as unknown as SourceCutoverEnvironment,
): ContentSourceConfiguration {
  const configuredMode = environment.CONTENT_SOURCE_MODE?.trim();
  const configuredPrevious = environment.CONTENT_SOURCE_PREVIOUS_MODE?.trim();
  const confirmation = environment.CONTENT_SOURCE_MODE_CONFIRM?.trim();

  if (!configuredMode) {
    if (configuredPrevious || confirmation) {
      configurationError(
        "Source transition variables require an explicit CONTENT_SOURCE_MODE.",
      );
    }
    return { mode: "legacy", previousMode: null, transition: null };
  }

  const mode = parseMode(configuredMode, "CONTENT_SOURCE_MODE");

  // Preserve an existing explicit legacy-only deployment without forcing it
  // to declare a transition that has not happened.
  if (mode === "legacy" && !configuredPrevious && !confirmation) {
    return { mode, previousMode: null, transition: null };
  }

  if (!configuredPrevious || !confirmation) {
    configurationError(
      "A source change requires CONTENT_SOURCE_PREVIOUS_MODE and CONTENT_SOURCE_MODE_CONFIRM.",
    );
  }

  const previousMode = parseMode(
    configuredPrevious,
    "CONTENT_SOURCE_PREVIOUS_MODE",
  );
  if (confirmation !== mode) {
    configurationError(
      "CONTENT_SOURCE_MODE_CONFIRM must exactly match CONTENT_SOURCE_MODE.",
    );
  }

  const transition = `${previousMode}->${mode}` as ContentSourceTransition;
  if (!ALLOWED_TRANSITIONS.has(transition)) {
    configurationError(
      "Only adjacent legacy/dual/database source transitions are allowed.",
    );
  }

  return { mode, previousMode, transition };
}

function parseRouteProbe(value: string | undefined, variable: string) {
  if (!value) {
    configurationError(`${variable} is required for database mode.`);
  }

  const match = value.trim().match(/^\/(garden|forest|lake|ruins)\/([^/]+)$/);
  const region = match ? REGIONS.get(match[1]) : undefined;
  const slug = match?.[2];
  if (!region || !slug || !SLUG_PATTERN.test(slug)) {
    configurationError(
      `${variable} must be a valid /garden|forest|lake|ruins/[slug] route.`,
    );
  }
  return { region, slug };
}

export function getDatabaseModeValidationProbes(
  environment: SourceCutoverEnvironment = process.env as unknown as SourceCutoverEnvironment,
): DatabaseModeValidationProbes {
  const probes = {
    published: parseRouteProbe(
      environment.CONTENT_DATABASE_PUBLISHED_PROBE,
      "CONTENT_DATABASE_PUBLISHED_PROBE",
    ),
    draft: parseRouteProbe(
      environment.CONTENT_DATABASE_DRAFT_PROBE,
      "CONTENT_DATABASE_DRAFT_PROBE",
    ),
    review: parseRouteProbe(
      environment.CONTENT_DATABASE_REVIEW_PROBE,
      "CONTENT_DATABASE_REVIEW_PROBE",
    ),
    archived: parseRouteProbe(
      environment.CONTENT_DATABASE_ARCHIVED_PROBE,
      "CONTENT_DATABASE_ARCHIVED_PROBE",
    ),
  };
  const keys = Object.values(probes).map(
    ({ region, slug }) => `${region}/${slug}`,
  );
  if (new Set(keys).size !== keys.length) {
    configurationError("Database lifecycle probe routes must be distinct.");
  }
  return probes;
}

function databaseValidationError(operation: string): never {
  throw new ContentServiceError(
    "database_validation_failed",
    "The database public content source is not ready.",
    operation,
  );
}

/**
 * Exercises every public database disposition before environment-driven
 * database-only mode may return content. Any unavailable or unexpected result
 * fails closed; validation never reads from the legacy source.
 */
export async function validateDatabaseMode(
  repository: ContentRepository,
  probes: DatabaseModeValidationProbes,
): Promise<void> {
  try {
    const [publishedItems] = await Promise.all([
      repository.getPublishedContent({
        regions: ["Garden", "Forest", "Lake", "Ruins"],
      }),
      repository.getPublishedHomeCuration(),
    ]);

    if (
      publishedItems.length === 0 ||
      publishedItems.some(({ row }) => row.lifecycle !== "Published") ||
      !publishedItems.some(
        ({ row }) =>
          row.region === probes.published.region &&
          row.slug === probes.published.slug,
      )
    ) {
      databaseValidationError("validatePublishedCollection");
    }

    const publishedDisposition = await repository.resolvePublicContentRoute(
      probes.published.region,
      probes.published.slug,
    );
    if (publishedDisposition.kind !== "published") {
      databaseValidationError("validatePublishedRoute");
    }

    const publishedDetail = await repository.getPublishedContentByRoute(
      probes.published.region,
      probes.published.slug,
    );
    if (
      !publishedDetail ||
      publishedDetail.row.lifecycle !== "Published" ||
      publishedDetail.row.region !== probes.published.region ||
      publishedDetail.row.slug !== probes.published.slug
    ) {
      databaseValidationError("validatePublishedDetail");
    }

    for (const [lifecycle, probe] of [
      ["Draft", probes.draft],
      ["Review", probes.review],
    ] as const) {
      const disposition = await repository.resolvePublicContentRoute(
        probe.region,
        probe.slug,
      );
      if (
        disposition.kind !== "not_found" ||
        disposition.legacyFallbackAllowed
      ) {
        databaseValidationError(`validate${lifecycle}Hidden`);
      }
    }

    const archivedDisposition = await repository.resolvePublicContentRoute(
      probes.archived.region,
      probes.archived.slug,
    );
    if (
      archivedDisposition.kind !== "archived" ||
      archivedDisposition.content.region !== probes.archived.region
    ) {
      databaseValidationError("validateArchivedRoute");
    }
  } catch (error) {
    if (
      error instanceof ContentServiceError &&
      error.code === "database_validation_failed"
    ) {
      throw error;
    }
    databaseValidationError("validateDatabasePublicBoundary");
  }
}
