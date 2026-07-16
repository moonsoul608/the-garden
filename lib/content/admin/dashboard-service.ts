import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  AdminDashboardService,
  DashboardLifecycle,
  DashboardLifecycleRecord,
  DashboardSummary,
} from "./dashboard-contracts";
import {
  createDashboardReadRepository,
  DashboardRepositoryError,
  type DashboardReadRepository,
  type DashboardRepositoryClient,
} from "./dashboard-repository";

type AuthorizeDashboardRequest = () => Promise<AuthenticatedUser>;

export class DashboardServiceUnavailableError extends Error {
  constructor() {
    super("The Garden Keeper dashboard is temporarily unavailable.");
    this.name = "DashboardServiceUnavailableError";
  }
}

export type AdminDashboardServiceDependencies = {
  authorize?: AuthorizeDashboardRequest;
  repository?: DashboardReadRepository;
  repositoryFactory?: () => Promise<DashboardReadRepository>;
};

function getEffectiveLifecycle(
  record: DashboardLifecycleRecord,
): DashboardLifecycle {
  if (
    record.projectionLifecycle === "Draft" &&
    record.activeRevisionLifecycle === "Review"
  ) {
    return "Review";
  }

  return record.projectionLifecycle;
}

export function mapDashboardSummary(
  records: readonly DashboardLifecycleRecord[],
): DashboardSummary {
  const lifecycleCounts: Record<DashboardLifecycle, number> = {
    Draft: 0,
    Review: 0,
    Published: 0,
    Archived: 0,
  };

  for (const record of records) {
    lifecycleCounts[getEffectiveLifecycle(record)] += 1;
  }

  return {
    totalContent: records.length,
    lifecycleCounts,
  };
}

async function createDefaultRepository(): Promise<DashboardReadRepository> {
  try {
    const client = await createClient();
    return createDashboardReadRepository(
      client as unknown as DashboardRepositoryClient,
    );
  } catch {
    throw new DashboardServiceUnavailableError();
  }
}

export function createAdminDashboardService(
  dependencies: AdminDashboardServiceDependencies = {},
): AdminDashboardService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<DashboardReadRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<DashboardReadRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function getDashboardSummary(): Promise<DashboardSummary> {
    await authorize();

    try {
      const records = await (await getRepository()).listLifecycleRecords();
      return mapDashboardSummary(records);
    } catch (error) {
      if (error instanceof DashboardServiceUnavailableError) throw error;
      if (error instanceof DashboardRepositoryError) {
        throw new DashboardServiceUnavailableError();
      }

      throw new DashboardServiceUnavailableError();
    }
  }

  return { getDashboardSummary };
}

let defaultDashboardService: AdminDashboardService | null = null;

function getDefaultDashboardService(): AdminDashboardService {
  defaultDashboardService ??= createAdminDashboardService();
  return defaultDashboardService;
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return getDefaultDashboardService().getDashboardSummary();
}
