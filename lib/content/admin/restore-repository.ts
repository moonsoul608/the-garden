import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import type { RestoreReceipt, RestoreVersionInput } from "./contracts";
import {
  ContentMutationError,
  mapContentMutationDatabaseError,
} from "./errors";

export interface RestoreRepository {
  restoreVersionToDraft(input: RestoreVersionInput): Promise<RestoreReceipt>;
}

export type RestoreRepositoryClient = SupabaseClient<ContentDatabase>;

function mapRestoreReceipt(value: Json): RestoreReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContentMutationError(
      "repository_failure",
      "restoreVersionToDraft",
    );
  }

  const {
    contentId,
    sourceVersionId,
    revisionId,
    operationId,
    preRestoreVersionId,
    lockVersion,
    restoredAt,
    restoredBy,
  } = value;

  if (
    typeof contentId !== "string" ||
    typeof sourceVersionId !== "string" ||
    typeof revisionId !== "string" ||
    typeof operationId !== "string" ||
    typeof preRestoreVersionId !== "string" ||
    !Number.isSafeInteger(lockVersion) ||
    (lockVersion as number) < 1 ||
    typeof restoredAt !== "string" ||
    typeof restoredBy !== "string"
  ) {
    throw new ContentMutationError(
      "repository_failure",
      "restoreVersionToDraft",
    );
  }

  return {
    contentId,
    sourceVersionId,
    revisionId,
    operationId,
    preRestoreVersionId,
    lockVersion: lockVersion as number,
    restoredAt,
    restoredBy,
  };
}

export function createRestoreRepository(
  client: RestoreRepositoryClient,
): RestoreRepository {
  return {
    async restoreVersionToDraft(
      input: RestoreVersionInput,
    ): Promise<RestoreReceipt> {
      const result = await client.rpc("restore_version_to_draft", {
        p_content_id: input.contentId,
        p_source_version_id: input.sourceVersionId,
        p_expected_archived_token: input.expectedArchivedToken,
        p_operation_id: input.operationId,
      });

      if (result.error) {
        throw mapContentMutationDatabaseError(
          result.error,
          "restoreVersionToDraft",
        );
      }

      return mapRestoreReceipt(result.data);
    },
  };
}
