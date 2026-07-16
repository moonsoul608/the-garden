import "server-only";

import type { Lifecycle } from "@/types";

export const DASHBOARD_LIFECYCLES = [
  "Draft",
  "Review",
  "Published",
  "Archived",
] as const satisfies readonly Lifecycle[];

export type DashboardLifecycle = (typeof DASHBOARD_LIFECYCLES)[number];

export type DashboardLifecycleRecord = Readonly<{
  projectionLifecycle: Lifecycle;
  activeRevisionLifecycle: "Draft" | "Review" | null;
}>;

export type DashboardLifecycleCounts = Readonly<
  Record<DashboardLifecycle, number>
>;

export type DashboardSummary = Readonly<{
  totalContent: number;
  lifecycleCounts: DashboardLifecycleCounts;
}>;

export interface AdminDashboardService {
  getDashboardSummary(): Promise<DashboardSummary>;
}
