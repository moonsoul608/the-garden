"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminContentService,
  createLifecycleManagementService,
} from "@/lib/content/admin";

import type { LifecycleActionState } from "./action-contracts";
import { createLifecycleActionHandlers } from "./action-handlers";

function handlers() {
  return createLifecycleActionHandlers({
    lifecycle: createLifecycleManagementService(),
    mutations: createAdminContentService(),
  });
}

function refreshLifecycleViews(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/admin/lifecycle");
}

export async function archiveContentAction(
  previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const result = await handlers().archiveContent(previousState, formData);
  if (result.status === "success") refreshLifecycleViews();
  return result;
}

export async function restoreContentAction(
  previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const result = await handlers().restoreContent(previousState, formData);
  if (result.status === "success") refreshLifecycleViews();
  return result;
}

export async function previewDeletionAction(
  previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  return handlers().previewDeletion(previousState, formData);
}

export async function deleteContentAction(
  previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const result = await handlers().deleteContent(previousState, formData);
  if (result.status === "success") refreshLifecycleViews();
  return result;
}
