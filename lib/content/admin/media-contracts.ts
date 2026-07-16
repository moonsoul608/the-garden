import "server-only";

import type { StorageObjectLifecycleState } from "./storage-contracts";

export const MEDIA_BUCKET = "cover-images" as const;
export const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_COVER_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedCoverMediaType =
  (typeof ALLOWED_COVER_MEDIA_TYPES)[number];

export type MediaReferenceStatus =
  | "Referenced"
  | "Unreferenced"
  | "QuarantineCandidate";

export type MediaObjectRecord = Readonly<{
  bucket: string;
  objectPath: string;
  physicalObjectExists: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  referenceCount: number;
  referencedContentCount: number;
  projectionReferenceCount: number;
  revisionReferenceCount: number;
  versionReferenceCount: number;
  lifecycleState: StorageObjectLifecycleState;
}>;

export type MediaObjectItem = MediaObjectRecord &
  Readonly<{
    displayName: string;
    referenceStatus: MediaReferenceStatus;
  }>;

export type MediaDraftTarget = Readonly<{
  contentId: string;
  revisionId: string;
  lockVersion: number;
  title: string;
  currentCoverPath: string | null;
}>;

export type MediaWorkspace = Readonly<{
  media: readonly MediaObjectItem[];
  draftTargets: readonly MediaDraftTarget[];
}>;

export type ReplaceDraftCoverInput = Readonly<{
  contentId: string;
  revisionId: string;
  expectedLockVersion: number;
  file: File;
}>;

export type CoverReplacementReceipt = Readonly<{
  contentId: string;
  revisionId: string;
  previousObjectPath: string | null;
  objectPath: string;
  lockVersion: number;
  updatedAt: string;
}>;

export interface MediaWorkspaceService {
  getWorkspace(): Promise<MediaWorkspace>;
  replaceDraftCover(
    input: ReplaceDraftCoverInput,
  ): Promise<CoverReplacementReceipt>;
}

