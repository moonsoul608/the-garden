import "server-only";

import type {
  AdminContentService,
  LifecycleManagementService,
} from "@/lib/content/admin";
import {
  ContentMutationError,
  LifecycleManagementUnavailableError,
} from "@/lib/content/admin";

import type {
  LifecycleActionState,
  SafeDeletionPreview,
} from "./action-contracts";

type LifecycleMutationService = Pick<
  AdminContentService,
  | "archiveContent"
  | "restoreVersionToDraft"
  | "previewDeletionImpact"
  | "deleteArchivedContent"
>;

type LifecycleContextService = Pick<
  LifecycleManagementService,
  "getLifecycleCommandContext"
>;

type LifecycleActionDependencies = {
  lifecycle: LifecycleContextService;
  mutations: LifecycleMutationService;
  createOperationId?: () => string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function state(
  status: LifecycleActionState["status"],
  message: string,
  preview: SafeDeletionPreview | null = null,
  destination: string | null = null,
): LifecycleActionState {
  return { status, message, destination, preview };
}

function safeError(error: unknown, fallback: string): LifecycleActionState {
  if (error instanceof LifecycleManagementUnavailableError) {
    return state(
      "error",
      "生命周期工作区不可用。没有内容记录被更改。",
    );
  }

  if (error instanceof ContentMutationError) {
    if (
      error.code === "archive_conflict" ||
      error.code === "restore_conflict" ||
      error.code === "delete_conflict" ||
      error.code === "impact_digest_mismatch"
    ) {
      return state(
        "conflict",
        "此内容记录在确认窗口打开后发生了变更。请重新加载后继续。",
      );
    }

    if (
      error.code === "archive_lifecycle_conflict" ||
      error.code === "restore_lifecycle_conflict" ||
      error.code === "delete_lifecycle_conflict" ||
      error.code === "active_editorial_workspace" ||
      error.code === "active_restore_conflict"
    ) {
      return state(
        "conflict",
        "此内容已不在所需生命周期状态。请重新加载查看当前状态。",
      );
    }

    if (
      error.code === "archiving_disabled" ||
      error.code === "restoring_disabled" ||
      error.code === "deletion_disabled"
    ) {
      return state("error", error.message);
    }
  }

  return state("error", fallback);
}

function unavailableTarget(): LifecycleActionState {
  return state(
    "conflict",
    "此内容在该路由下已不可用。请重新加载后继续。",
  );
}

function wrongLifecycle(): LifecycleActionState {
  return state(
    "conflict",
    "此内容已不在所需生命周期状态。请重新加载查看当前状态。",
  );
}

export function createLifecycleActionHandlers({
  lifecycle,
  mutations,
  createOperationId = () => crypto.randomUUID(),
}: LifecycleActionDependencies) {
  async function archiveContent(
    _previousState: LifecycleActionState,
    formData: FormData,
  ): Promise<LifecycleActionState> {
    try {
      const target = await lifecycle.getLifecycleCommandContext(
        text(formData, "canonicalRoute"),
      );
      if (!target) return unavailableTarget();
      if (target.lifecycle !== "Published") return wrongLifecycle();

      await mutations.archiveContent({
        contentId: target.contentId,
        expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
        operationId: createOperationId(),
      });

      return state(
        "success",
        "已安全归档。公开路由现已移出发现入口。",
        null,
        "/admin/content",
      );
    } catch (error) {
      return safeError(
        error,
        "归档无法完成。已发布内容记录未被更改。",
      );
    }
  }

  async function restoreContent(
    _previousState: LifecycleActionState,
    formData: FormData,
  ): Promise<LifecycleActionState> {
    try {
      const target = await lifecycle.getLifecycleCommandContext(
        text(formData, "canonicalRoute"),
      );
      if (!target) return unavailableTarget();
      if (target.lifecycle !== "Archived") return wrongLifecycle();
      if (!target.sourceArchiveVersionId) {
        return state(
          "error",
          "受保护的归档检查点不可用。未创建草稿。",
        );
      }

      const receipt = await mutations.restoreVersionToDraft({
        contentId: target.contentId,
        sourceVersionId: target.sourceArchiveVersionId,
        expectedArchivedToken: text(formData, "expectedUpdatedAt"),
        operationId: createOperationId(),
      });

      return state(
        "success",
        "已恢复为私有草稿，并保留归档来源凭据。",
        null,
        `/admin/content/${receipt.revisionId}`,
      );
    } catch (error) {
      return safeError(
        error,
        "归档无法恢复。未创建草稿。",
      );
    }
  }

  async function previewDeletion(
    _previousState: LifecycleActionState,
    formData: FormData,
  ): Promise<LifecycleActionState> {
    try {
      const target = await lifecycle.getLifecycleCommandContext(
        text(formData, "canonicalRoute"),
      );
      if (!target) return unavailableTarget();
      if (target.lifecycle !== "Archived") return wrongLifecycle();

      const impact = await mutations.previewDeletionImpact({
        contentId: target.contentId,
      });
      if (impact.contentId !== target.contentId) {
        return state(
          "error",
          "删除预览无法验证。没有内容记录被更改。",
        );
      }

      const affectedRoutes = [
        impact.canonicalRoute,
        ...impact.historicalRoutes,
        ...impact.redirectReferences.map(({ routePath }) => routePath),
      ].filter((route, index, routes) => routes.indexOf(route) === index);

      return state(
        "preview",
        "影响预览已生成。确认前请检查所有影响。",
        {
          canonicalRoute: impact.canonicalRoute,
          affectedRoutes,
          redirectReferenceCount: impact.redirectReferences.length,
          inboundRelationCount: impact.inboundRelations.length,
          outboundRelationCount: impact.outboundRelations.length,
          versionCount: impact.versionCount,
          storageReferenceCount: impact.storageReferenceCount,
          affectedSurfaces: impact.affectedInvalidationSurfaces,
          expectedArchivedToken: impact.expectedArchivedToken,
          impactDigest: impact.impactDigest,
        },
      );
    } catch (error) {
      return safeError(
        error,
        "无法生成删除影响预览。没有内容记录被更改。",
      );
    }
  }

  async function deleteContent(
    _previousState: LifecycleActionState,
    formData: FormData,
  ): Promise<LifecycleActionState> {
    if (text(formData, "deleteConfirmation") !== "DELETE") {
      return state(
        "error",
        "请准确输入 DELETE 后再确认此不可逆操作。",
      );
    }

    try {
      const target = await lifecycle.getLifecycleCommandContext(
        text(formData, "canonicalRoute"),
      );
      if (!target) return unavailableTarget();
      if (target.lifecycle !== "Archived") return wrongLifecycle();

      await mutations.deleteArchivedContent({
        contentId: target.contentId,
        expectedArchivedToken: text(formData, "expectedArchivedToken"),
        impactDigest: text(formData, "impactDigest"),
        operationId: createOperationId(),
      });

      return state(
        "success",
        "实时内容记录已永久删除，其路由已设为终止状态。受保护历史仍保持完整。",
      );
    } catch (error) {
      return safeError(
        error,
        "永久删除无法完成。已归档内容记录未被更改。",
      );
    }
  }

  return { archiveContent, restoreContent, previewDeletion, deleteContent };
}
