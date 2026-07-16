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
): LifecycleActionState {
  return { status, message, preview };
}

function safeError(error: unknown, fallback: string): LifecycleActionState {
  if (error instanceof LifecycleManagementUnavailableError) {
    return state(
      "error",
      "The lifecycle workspace is unavailable. No garden record was changed.",
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
        "This garden record changed while the confirmation was open. Reload before continuing.",
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
        "This item is no longer in the required lifecycle state. Reload to see its current path.",
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
    "This item is no longer available at that garden route. Reload before continuing.",
  );
}

function wrongLifecycle(): LifecycleActionState {
  return state(
    "conflict",
    "This item is no longer in the required lifecycle state. Reload to see its current path.",
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
        "Archived safely. The public route now rests outside garden discovery.",
      );
    } catch (error) {
      return safeError(
        error,
        "Archiving could not be completed. The published garden record was left unchanged.",
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
          "The protected archive checkpoint is unavailable. No Draft was created.",
        );
      }

      await mutations.restoreVersionToDraft({
        contentId: target.contentId,
        sourceVersionId: target.sourceArchiveVersionId,
        expectedArchivedToken: text(formData, "expectedUpdatedAt"),
        operationId: createOperationId(),
      });

      return state(
        "success",
        "Restored into a private Draft with its archive provenance preserved.",
      );
    } catch (error) {
      return safeError(
        error,
        "The archive could not be restored. No Draft was created.",
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
          "The deletion preview could not be verified. No garden record was changed.",
        );
      }

      const affectedRoutes = [
        impact.canonicalRoute,
        ...impact.historicalRoutes,
        ...impact.redirectReferences.map(({ routePath }) => routePath),
      ].filter((route, index, routes) => routes.indexOf(route) === index);

      return state(
        "preview",
        "Impact preview prepared. Review every effect before confirming.",
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
        "The deletion impact could not be prepared. No garden record was changed.",
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
        "Type DELETE exactly before confirming this irreversible action.",
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
        "The live garden record was permanently removed and its routes were made terminal. Protected history remains intact.",
      );
    } catch (error) {
      return safeError(
        error,
        "Permanent deletion could not be completed. The archived garden record was left unchanged.",
      );
    }
  }

  return { archiveContent, restoreContent, previewDeletion, deleteContent };
}
