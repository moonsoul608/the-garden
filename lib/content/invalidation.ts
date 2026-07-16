import type { Lifecycle, RegionName } from "@/types";

export const CONTENT_LIFECYCLE_INVALIDATION_TARGETS = [
  "route",
  "metadata",
  "sitemap",
  "search",
] as const;

export type ContentLifecycleInvalidationTarget =
  (typeof CONTENT_LIFECYCLE_INVALIDATION_TARGETS)[number];

export type ContentLifecycleInvalidation = {
  contentId: string;
  region: RegionName;
  slug: string;
  from: Lifecycle;
  to: Lifecycle;
  targets: typeof CONTENT_LIFECYCLE_INVALIDATION_TARGETS;
};

/** Contract only. Cache and index infrastructure remain outside this phase. */
export interface ContentLifecycleInvalidationHook {
  invalidate(change: ContentLifecycleInvalidation): Promise<void>;
}
