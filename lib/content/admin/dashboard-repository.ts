import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase } from "@/types/database";

import type { DashboardLifecycleRecord } from "./dashboard-contracts";

export class DashboardRepositoryError extends Error {
  constructor() {
    super("The dashboard data source could not complete the request.");
    this.name = "DashboardRepositoryError";
  }
}

export interface DashboardReadRepository {
  listLifecycleRecords(): Promise<DashboardLifecycleRecord[]>;
}

type DashboardRepositoryClient = SupabaseClient<ContentDatabase>;

export function createDashboardReadRepository(
  client: DashboardRepositoryClient,
): DashboardReadRepository {
  async function listLifecycleRecords(): Promise<DashboardLifecycleRecord[]> {
    const contentResult = await client.from("contents").select("id,lifecycle");

    if (contentResult.error) throw new DashboardRepositoryError();

    const contents = contentResult.data ?? [];
    const draftContentIds = contents
      .filter(({ lifecycle }) => lifecycle === "Draft")
      .map(({ id }) => id);

    if (draftContentIds.length === 0) {
      return contents.map(({ lifecycle }) => ({
        projectionLifecycle: lifecycle,
        activeRevisionLifecycle: null,
      }));
    }

    const revisionResult = await client
      .from("content_revisions")
      .select("content_id,lifecycle")
      .in("content_id", draftContentIds);

    if (revisionResult.error) throw new DashboardRepositoryError();

    const activeRevisionLifecycles = new Map(
      (revisionResult.data ?? []).map(({ content_id, lifecycle }) => [
        content_id,
        lifecycle,
      ]),
    );

    return contents.map(({ id, lifecycle }) => ({
      projectionLifecycle: lifecycle,
      activeRevisionLifecycle:
        lifecycle === "Draft"
          ? (activeRevisionLifecycles.get(id) ?? null)
          : null,
    }));
  }

  return { listLifecycleRecords };
}

export type { DashboardRepositoryClient };
