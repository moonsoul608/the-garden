import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RegionName } from "@/types";

import type {
  LifecycleCommandContext,
  LifecycleListItem,
  LifecycleManagementService,
  LifecycleOverview,
} from "./lifecycle-management-contracts";
import {
  createLifecycleManagementReadRepository,
  LifecycleManagementRepositoryError,
  type LifecycleManagementReadRepository,
  type LifecycleManagementRecord,
  type LifecycleManagementRepositoryClient,
} from "./lifecycle-management-repository";

type AuthorizeLifecycleRequest = () => Promise<AuthenticatedUser>;

export class LifecycleManagementUnavailableError extends Error {
  constructor() {
    super("The lifecycle workspace is temporarily unavailable.");
    this.name = "LifecycleManagementUnavailableError";
  }
}

export type LifecycleManagementServiceDependencies = {
  authorize?: AuthorizeLifecycleRequest;
  repository?: LifecycleManagementReadRepository;
  repositoryFactory?: () => Promise<LifecycleManagementReadRepository>;
};

const ROUTE_REGIONS: Readonly<Record<string, RegionName>> = {
  garden: "Garden",
  forest: "Forest",
  lake: "Lake",
  ruins: "Ruins",
};

function preferredTitle(record: LifecycleManagementRecord): string {
  return record.titleEn?.trim() || record.titleZh?.trim() || "Untitled content";
}

function canonicalRoute(record: LifecycleManagementRecord): string | null {
  if (!record.slug) return null;
  return `/${record.region.toLocaleLowerCase()}/${record.slug}`;
}

function latestTimestamp(left: string, right: string | null): string {
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

export function mapLifecycleListItem(
  record: LifecycleManagementRecord,
): LifecycleListItem {
  const revision = record.activeRevision;
  const restoredAt = revision?.restoredAt ?? null;
  const action = restoredAt
    ? { label: "Restored to Draft", occurredAt: restoredAt }
    : record.lifecycle === "Archived" && record.archivedAt
      ? { label: "Archived", occurredAt: record.archivedAt }
      : record.publishedAt
        ? { label: "Published", occurredAt: record.publishedAt }
        : { label: "Updated", occurredAt: record.updatedAt };

  return {
    title: preferredTitle(record),
    region: record.region,
    canonicalRoute: canonicalRoute(record),
    lifecycle: record.lifecycle,
    updatedAt: latestTimestamp(record.updatedAt, revision?.updatedAt ?? null),
    concurrencyToken: record.updatedAt,
    lastAction: action.label,
    lastActionAt: action.occurredAt,
    sourceArchiveAt: record.sourceArchive?.createdAt ?? null,
    workspaceState: revision?.lifecycle ?? null,
  };
}

function parseCanonicalRoute(
  value: string,
): { region: RegionName; slug: string } | null {
  const match = /^\/(garden|forest|lake|ruins)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const region = ROUTE_REGIONS[match[1]];
  const slug = match[2];
  return region && slug ? { region, slug } : null;
}

async function createDefaultRepository(): Promise<LifecycleManagementReadRepository> {
  try {
    const client = await createClient();
    return createLifecycleManagementReadRepository(
      client as unknown as LifecycleManagementRepositoryClient,
    );
  } catch {
    throw new LifecycleManagementUnavailableError();
  }
}

export function createLifecycleManagementService(
  dependencies: LifecycleManagementServiceDependencies = {},
): LifecycleManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<LifecycleManagementReadRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<LifecycleManagementReadRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function listLifecycleOverview(): Promise<LifecycleOverview> {
    await authorize();

    try {
      const items = (await (await getRepository()).listLifecycleRecords())
        .map(mapLifecycleListItem)
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        );

      return {
        published: items.filter(({ lifecycle }) => lifecycle === "Published"),
        archived: items.filter(({ lifecycle }) => lifecycle === "Archived"),
      };
    } catch (error) {
      if (error instanceof LifecycleManagementUnavailableError) throw error;
      if (error instanceof LifecycleManagementRepositoryError) {
        throw new LifecycleManagementUnavailableError();
      }
      throw new LifecycleManagementUnavailableError();
    }
  }

  async function getLifecycleCommandContext(
    route: string,
  ): Promise<LifecycleCommandContext | null> {
    await authorize();
    const parsed = parseCanonicalRoute(route);
    if (!parsed) return null;

    try {
      const record = await (
        await getRepository()
      ).getLifecycleRecord(parsed.region, parsed.slug);
      const routeForRecord = record ? canonicalRoute(record) : null;
      if (!record || routeForRecord !== route) return null;

      return {
        contentId: record.contentId,
        canonicalRoute: routeForRecord,
        lifecycle: record.lifecycle,
        updatedAt: record.updatedAt,
        sourceArchiveVersionId: record.sourceArchive?.versionId ?? null,
        workspaceState: record.activeRevision?.lifecycle ?? null,
      };
    } catch (error) {
      if (error instanceof LifecycleManagementRepositoryError) {
        throw new LifecycleManagementUnavailableError();
      }
      throw new LifecycleManagementUnavailableError();
    }
  }

  return { listLifecycleOverview, getLifecycleCommandContext };
}

let defaultLifecycleService: LifecycleManagementService | null = null;

function getDefaultLifecycleService(): LifecycleManagementService {
  defaultLifecycleService ??= createLifecycleManagementService();
  return defaultLifecycleService;
}

export function listLifecycleOverview(): Promise<LifecycleOverview> {
  return getDefaultLifecycleService().listLifecycleOverview();
}
