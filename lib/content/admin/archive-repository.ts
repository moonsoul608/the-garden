import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import type { ArchiveContentInput, ArchiveReceipt } from "./contracts";
import {
  ContentMutationError,
  mapContentMutationDatabaseError,
} from "./errors";

export interface ArchiveRepository {
  archivePublishedContent(input: ArchiveContentInput): Promise<ArchiveReceipt>;
}

export type ArchiveRepositoryClient = SupabaseClient<ContentDatabase>;

function mapArchiveReceipt(value: Json): ArchiveReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContentMutationError("repository_failure", "archiveContent");
  }

  const { contentId, operationId, versionId, archivedAt, archivedBy } = value;

  if (
    typeof contentId !== "string" ||
    typeof operationId !== "string" ||
    typeof versionId !== "string" ||
    typeof archivedAt !== "string" ||
    typeof archivedBy !== "string"
  ) {
    throw new ContentMutationError("repository_failure", "archiveContent");
  }

  return { contentId, operationId, versionId, archivedAt, archivedBy };
}

export function createArchiveRepository(
  client: ArchiveRepositoryClient,
): ArchiveRepository {
  return {
    async archivePublishedContent(
      input: ArchiveContentInput,
    ): Promise<ArchiveReceipt> {
      const result = await client.rpc("archive_published_content", {
        p_content_id: input.contentId,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_operation_id: input.operationId,
      });

      if (result.error) {
        throw mapContentMutationDatabaseError(
          result.error,
          "archiveContent",
        );
      }

      return mapArchiveReceipt(result.data);
    },
  };
}
