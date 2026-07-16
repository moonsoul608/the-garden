"use server";

import { revalidatePath } from "next/cache";

import { createMediaWorkspaceService } from "@/lib/content/admin";

import type { MediaActionState } from "./action-contracts";
import { createMediaActionHandlers } from "./action-handlers";

export async function replaceDraftCoverAction(
  previousState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const result = await createMediaActionHandlers(
    createMediaWorkspaceService(),
  ).replaceDraftCover(previousState, formData);

  if (result.status === "success") {
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    revalidatePath("/admin/media");
    const revisionId = formData.get("revisionId");
    if (typeof revisionId === "string" && revisionId) {
      revalidatePath(`/admin/content/${revisionId}`);
    }
  }

  return result;
}

