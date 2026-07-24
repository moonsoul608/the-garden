"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminContentService } from "@/lib/content/admin";

import type { ContentFormState } from "./form-contracts";
import { createContentFormHandlers } from "./form-handlers";

export async function createDraftAction(
  previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const result = await createContentFormHandlers(
    createAdminContentService(),
  ).createDraft(previousState, formData);

  if (result.status === "success" && result.revisionId) {
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    redirect(`/admin/content/${result.revisionId}`);
  }

  return result;
}

export async function saveDraftAction(
  previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const result = await createContentFormHandlers(
    createAdminContentService(),
  ).saveDraft(previousState, formData);

  if (result.status === "success" && result.revisionId) {
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    revalidatePath(`/admin/content/${result.revisionId}`);
  }

  return result;
}

export async function startDraftRevisionAction(
  formData: FormData,
): Promise<void> {
  const revision = await createAdminContentService().startDraftRevision({
    contentId: String(formData.get("contentId") ?? ""),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  redirect(`/admin/content/${revision.revisionId}`);
}
