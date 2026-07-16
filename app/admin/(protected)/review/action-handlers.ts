import "server-only";

import type { AdminContentService } from "@/lib/content/admin";
import { ContentMutationError } from "@/lib/content/admin";
import { ContentValidationError } from "@/lib/content/errors";

import type { ReviewActionState } from "./action-contracts";

type ReviewActionService = Pick<
  AdminContentService,
  "prepareReview" | "submitForReview" | "returnToDraft" | "publishReview"
>;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function transitionInput(formData: FormData) {
  return {
    contentId: text(formData, "contentId"),
    revisionId: text(formData, "revisionId"),
    expectedLockVersion: Number(text(formData, "expectedLockVersion")),
  };
}

function errorState(error: unknown, fallback: string): ReviewActionState {
  if (error instanceof ContentMutationError) {
    if (error.code === "revision_conflict") {
      return {
        status: "conflict",
        message:
          "This revision changed while the page was open. Reload before continuing.",
        destination: null,
        publishedAt: null,
      };
    }

    if (
      error.code === "revision_not_found" ||
      error.code === "invalid_revision_state"
    ) {
      return {
        status: "error",
        message:
          "This review is no longer waiting here. Refresh the queue to see its current state.",
        destination: "/admin/review",
        publishedAt: null,
      };
    }

    return {
      status: "error",
      message: error.message,
      destination: null,
      publishedAt: null,
    };
  }

  if (error instanceof ContentValidationError) {
    return {
      status: "error",
      message:
        "The readiness check changed. Review the checklist again before continuing.",
      destination: null,
      publishedAt: null,
    };
  }

  return {
    status: "error",
    message: fallback,
    destination: null,
    publishedAt: null,
  };
}

export function createReviewActionHandlers(service: ReviewActionService) {
  async function submitForReview(
    _previousState: ReviewActionState,
    formData: FormData,
  ): Promise<ReviewActionState> {
    try {
      const input = transitionInput(formData);
      const report = await service.prepareReview({
        contentId: input.contentId,
        revisionId: input.revisionId,
      });

      if (!report.ready) {
        return {
          status: "error",
          message:
            "This Draft is not ready for Review. Tend the checklist items before submitting it.",
          destination: null,
          publishedAt: null,
        };
      }

      await service.submitForReview(input);
      return {
        status: "success",
        message: "Submitted for Review.",
        destination: `/admin/review/${input.revisionId}`,
        publishedAt: null,
      };
    } catch (error) {
      return errorState(
        error,
        "The Draft could not be submitted for Review. Try again from this page.",
      );
    }
  }

  async function returnToDraft(
    _previousState: ReviewActionState,
    formData: FormData,
  ): Promise<ReviewActionState> {
    const reason = text(formData, "reason");
    if (!reason) {
      return {
        status: "error",
        message: "Add a reason before returning this Review to Draft.",
        destination: null,
        publishedAt: null,
      };
    }

    try {
      const input = transitionInput(formData);
      await service.returnToDraft(input);
      return {
        status: "success",
        message: "Returned to Draft.",
        destination: `/admin/content/${input.revisionId}`,
        publishedAt: null,
      };
    } catch (error) {
      return errorState(
        error,
        "The Review could not be returned to Draft. Try again from this page.",
      );
    }
  }

  async function publishReview(
    _previousState: ReviewActionState,
    formData: FormData,
  ): Promise<ReviewActionState> {
    if (text(formData, "publishConfirmation") !== "confirmed") {
      return {
        status: "error",
        message: "Confirm that this Review is ready to publish.",
        destination: null,
        publishedAt: null,
      };
    }

    try {
      const input = transitionInput(formData);
      const receipt = await service.publishReview(input);
      return {
        status: "success",
        message:
          "Published safely. Repeating this confirmed request will not create another version.",
        destination: "/admin/review",
        publishedAt: receipt.publishedAt,
      };
    } catch (error) {
      return errorState(
        error,
        "Publishing could not be completed. The current published content was left unchanged.",
      );
    }
  }

  return { submitForReview, returnToDraft, publishReview };
}
