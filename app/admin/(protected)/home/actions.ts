"use server";

import { revalidatePath } from "next/cache";

import {
  createHomeCurationManagementService,
  HomeCurationInputError,
  HomeCurationManagementUnavailableError,
} from "@/lib/content/admin";
import type { HomeCurationSlot } from "@/types";

import type { HomeCurationActionState } from "./action-contracts";

const HOME_CURATION_SLOTS = [
  "currentlyGrowing",
  "recentlyPlanted",
] as const satisfies readonly HomeCurationSlot[];

function actionState(
  status: HomeCurationActionState["status"],
  message: string,
): HomeCurationActionState {
  return { status, message };
}

function contentIds(formData: FormData, slot: HomeCurationSlot): string[] {
  return formData
    .getAll(slot)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeError(error: unknown): HomeCurationActionState {
  if (error instanceof HomeCurationInputError) {
    return actionState("error", error.message);
  }

  if (error instanceof HomeCurationManagementUnavailableError) {
    return actionState(
      "error",
      "首页精选暂时不可用。首页内容行未被更改。",
    );
  }

  return actionState(
    "error",
    "首页精选无法保存。首页内容行未被更改。",
  );
}

function refreshHomeCuration(): void {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/home");
}

export async function saveHomeCurationAction(
  _previousState: HomeCurationActionState,
  formData: FormData,
): Promise<HomeCurationActionState> {
  try {
    await createHomeCurationManagementService().saveHomeCuration({
      selections: HOME_CURATION_SLOTS.flatMap((slot) =>
        contentIds(formData, slot).map((contentId, order) => ({
          slot,
          contentId,
          order,
        })),
      ),
    });
    refreshHomeCuration();
    return actionState("success", "首页精选已保存。");
  } catch (error) {
    return safeError(error);
  }
}
