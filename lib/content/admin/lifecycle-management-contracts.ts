import "server-only";

import type { RegionName } from "@/types";

export type ManagedLifecycle = "Published" | "Archived";

export type LifecycleWorkspaceState = "Draft" | "Review" | null;

export type LifecycleListItem = Readonly<{
  title: string;
  region: RegionName;
  canonicalRoute: string | null;
  lifecycle: ManagedLifecycle;
  updatedAt: string;
  concurrencyToken: string;
  lastAction: string;
  lastActionAt: string;
  sourceArchiveAt: string | null;
  workspaceState: LifecycleWorkspaceState;
}>;

export type LifecycleOverview = Readonly<{
  published: readonly LifecycleListItem[];
  archived: readonly LifecycleListItem[];
}>;

/** Server-only command context. Never pass this object to a Client Component. */
export type LifecycleCommandContext = Readonly<{
  contentId: string;
  canonicalRoute: string;
  lifecycle: ManagedLifecycle;
  updatedAt: string;
  sourceArchiveVersionId: string | null;
  workspaceState: LifecycleWorkspaceState;
}>;

export interface LifecycleManagementService {
  listLifecycleOverview(): Promise<LifecycleOverview>;
  getLifecycleCommandContext(
    canonicalRoute: string,
  ): Promise<LifecycleCommandContext | null>;
}
