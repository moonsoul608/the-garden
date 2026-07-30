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
          "此修订在页面打开后发生了变更。请重新加载后继续。",
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
          "此审核项已不在当前队列中。请刷新队列查看最新状态。",
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
        "准备情况检查已变化。请重新查看清单后继续。",
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
            "此草稿尚未准备好提交审核。请先处理清单中的项目。",
          destination: null,
          publishedAt: null,
        };
      }

      await service.submitForReview(input);
      return {
        status: "success",
        message: "已提交审核。",
        destination: `/admin/review/${input.revisionId}`,
        publishedAt: null,
      };
    } catch (error) {
      return errorState(
        error,
        "草稿无法提交审核。请在当前页面重试。",
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
        message: "退回草稿前请填写原因。",
        destination: null,
        publishedAt: null,
      };
    }

    try {
      const input = transitionInput(formData);
      await service.returnToDraft(input);
      return {
        status: "success",
        message: "已退回草稿。",
        destination: `/admin/content/${input.revisionId}`,
        publishedAt: null,
      };
    } catch (error) {
      return errorState(
        error,
        "无法退回草稿。请在当前页面重试。",
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
        message: "请确认此审核项可以发布。",
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
          "已安全发布。重复提交此确认请求不会创建新的版本。",
        destination: "/admin/content",
        publishedAt: receipt.publishedAt,
        publishedRegion: receipt.region,
        publishedSlug: receipt.slug,
      };
    } catch (error) {
      return errorState(
        error,
        "发布无法完成。当前已发布内容未被更改。",
      );
    }
  }

  return { submitForReview, returnToDraft, publishReview };
}
