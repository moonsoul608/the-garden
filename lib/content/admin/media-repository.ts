import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import {
  MEDIA_BUCKET,
  type MediaObjectRecord,
} from "./media-contracts";
import type { StorageObjectLifecycleState } from "./storage-contracts";

type JsonObject = { [key: string]: Json | undefined };

const LIFECYCLE_STATES = new Set<StorageObjectLifecycleState>([
  "Referenced",
  "Unreferenced",
  "Quarantine",
  "EligibleForPurge",
]);

export class MediaRepositoryError extends Error {
  constructor() {
    super("The media workspace data source could not complete the request.");
    this.name = "MediaRepositoryError";
  }
}

export interface MediaRepository {
  listMediaObjects(): Promise<MediaObjectRecord[]>;
  uploadCover(input: {
    objectPath: string;
    file: File;
    contentType: string;
  }): Promise<void>;
}

function isObject(value: Json | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: Json | undefined): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function nullableString(value: Json | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new MediaRepositoryError();
  return value;
}

export function mapMediaObjectRecord(value: Json): MediaObjectRecord {
  if (!isObject(value)) throw new MediaRepositoryError();

  const {
    bucket,
    objectPath,
    physicalObjectExists,
    mimeType,
    sizeBytes,
    createdAt,
    updatedAt,
    referenceCount,
    referencedContentCount,
    projectionReferenceCount,
    revisionReferenceCount,
    versionReferenceCount,
    lifecycleState,
  } = value;

  if (
    typeof bucket !== "string" ||
    typeof objectPath !== "string" ||
    typeof physicalObjectExists !== "boolean" ||
    (sizeBytes !== null && !isCount(sizeBytes)) ||
    !isCount(referenceCount) ||
    !isCount(referencedContentCount) ||
    !isCount(projectionReferenceCount) ||
    !isCount(revisionReferenceCount) ||
    !isCount(versionReferenceCount) ||
    typeof lifecycleState !== "string" ||
    !LIFECYCLE_STATES.has(lifecycleState as StorageObjectLifecycleState)
  ) {
    throw new MediaRepositoryError();
  }

  return {
    bucket,
    objectPath,
    physicalObjectExists,
    mimeType: nullableString(mimeType),
    sizeBytes: sizeBytes as number | null,
    createdAt: nullableString(createdAt),
    updatedAt: nullableString(updatedAt),
    referenceCount,
    referencedContentCount,
    projectionReferenceCount,
    revisionReferenceCount,
    versionReferenceCount,
    lifecycleState: lifecycleState as StorageObjectLifecycleState,
  };
}

export type MediaRepositoryClient = SupabaseClient<ContentDatabase>;

export function createMediaRepository(
  client: MediaRepositoryClient,
): MediaRepository {
  async function listMediaObjects(): Promise<MediaObjectRecord[]> {
    const result = await client.rpc("list_keeper_media_workspace");
    if (result.error || !Array.isArray(result.data)) {
      console.error("list_keeper_media_workspace RPC failed", {
        error: result.error,
        data: result.data,
        dataType: typeof result.data,
        isArray: Array.isArray(result.data),
      });
      throw new MediaRepositoryError();
    }

    return result.data.map((value) => mapMediaObjectRecord(value));
  }

  async function uploadCover(input: {
    objectPath: string;
    file: File;
    contentType: string;
  }): Promise<void> {
    const result = await client.storage.from(MEDIA_BUCKET).upload(
      input.objectPath,
      input.file,
      {
        cacheControl: "3600",
        contentType: input.contentType,
        upsert: false,
      },
    );

    if (result.error) throw new MediaRepositoryError();
  }

  return { listMediaObjects, uploadCover };
}

