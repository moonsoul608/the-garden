"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminContentService } from "@/lib/content/admin";

import type { ReviewActionState } from "./action-contracts";
import { createReviewActionHandlers } from "./action-handlers";

function refreshKeeperViews(revisionId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${revisionId}`);
}

export async function submitForReviewAction(
  previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const result = await createReviewActionHandlers(
    createAdminContentService(),
  ).submitForReview(previousState, formData);

  if (result.status === "success") {
    refreshKeeperViews(String(formData.get("revisionId") ?? ""));
    if (result.destination) redirect(result.destination);
  }

  return result;
}

export async function returnToDraftAction(
  previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const result = await createReviewActionHandlers(
    createAdminContentService(),
  ).returnToDraft(previousState, formData);

  if (result.status === "success") {
    refreshKeeperViews(String(formData.get("revisionId") ?? ""));
  }

  return result;
}

export async function publishReviewAction(
  previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const result = await createReviewActionHandlers(
    createAdminContentService(),
  ).publishReview(previousState, formData);

  if (result.status === "success") {
    refreshKeeperViews(String(formData.get("revisionId") ?? ""));
    redirect(result.destination ?? "/admin/content");
  }

  return result;
}
