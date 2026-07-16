import "server-only";

import type { MediaWorkspaceService } from "@/lib/content/admin";
import {
  MediaDraftUnavailableError,
  MediaReferenceUpdateError,
  MediaValidationError,
} from "@/lib/content/admin";

import type { MediaActionState } from "./action-contracts";

function requiredText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safelyMapError(error: unknown): MediaActionState {
  if (
    error instanceof MediaValidationError ||
    error instanceof MediaDraftUnavailableError ||
    error instanceof MediaReferenceUpdateError
  ) {
    return {
      status: "error",
      message: error.message,
      objectPath: null,
      previousObjectPath: null,
    };
  }

  return {
    status: "error",
    message: "The cover could not be stored. Try again without leaving this page.",
    objectPath: null,
    previousObjectPath: null,
  };
}

export function createMediaActionHandlers(service: MediaWorkspaceService) {
  async function replaceDraftCover(
    _previousState: MediaActionState,
    formData: FormData,
  ): Promise<MediaActionState> {
    try {
      const receipt = await service.replaceDraftCover({
        contentId: requiredText(formData, "contentId"),
        revisionId: requiredText(formData, "revisionId"),
        expectedLockVersion: Number(
          requiredText(formData, "expectedLockVersion"),
        ),
        file: formData.get("cover") as File,
      });

      return {
        status: "success",
        message: receipt.previousObjectPath
          ? "New cover attached. The previous object remains preserved."
          : "Cover uploaded and attached to the Draft.",
        objectPath: receipt.objectPath,
        previousObjectPath: receipt.previousObjectPath,
      };
    } catch (error) {
      return safelyMapError(error);
    }
  }

  return { replaceDraftCover };
}

