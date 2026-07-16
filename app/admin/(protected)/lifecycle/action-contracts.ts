export type LifecycleActionStatus =
  | "idle"
  | "preview"
  | "success"
  | "error"
  | "conflict";

export type SafeDeletionPreview = Readonly<{
  canonicalRoute: string;
  affectedRoutes: readonly string[];
  redirectReferenceCount: number;
  inboundRelationCount: number;
  outboundRelationCount: number;
  versionCount: number;
  storageReferenceCount: number;
  affectedSurfaces: readonly string[];
  expectedArchivedToken: string;
  impactDigest: string;
}>;

export type LifecycleActionState = Readonly<{
  status: LifecycleActionStatus;
  message: string | null;
  preview: SafeDeletionPreview | null;
}>;

export const INITIAL_LIFECYCLE_ACTION_STATE: LifecycleActionState = {
  status: "idle",
  message: null,
  preview: null,
};
