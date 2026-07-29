import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { HomeCurationSlot } from "@/types";

import type {
  HomeCurationContentOption,
  HomeCurationManagementService,
  HomeCurationSelection,
  HomeCurationSlotItem,
  HomeCurationWorkspace,
  SaveHomeCurationInput,
} from "./home-curation-contracts";
import { HOME_CURATION_SLOTS } from "./home-curation-contracts";
import {
  createHomeCurationRepository,
  HomeCurationRepositoryError,
  type HomeCurationRepository,
  type HomeCurationRepositoryClient,
} from "./home-curation-repository";

type AuthorizeHomeCurationRequest = () => Promise<AuthenticatedUser>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class HomeCurationManagementUnavailableError extends Error {
  constructor() {
    super("首页精选暂时不可用。");
    this.name = "HomeCurationManagementUnavailableError";
  }
}

export class HomeCurationInputError extends Error {
  constructor(message = "首页精选选择无效。") {
    super(message);
    this.name = "HomeCurationInputError";
  }
}

export type HomeCurationManagementServiceDependencies = {
  authorize?: AuthorizeHomeCurationRequest;
  repository?: HomeCurationRepository;
  repositoryFactory?: () => Promise<HomeCurationRepository>;
};

function isHomeCurationSlot(value: string): value is HomeCurationSlot {
  return HOME_CURATION_SLOTS.includes(value as HomeCurationSlot);
}

function emptySlots(): Record<HomeCurationSlot, HomeCurationSlotItem[]> {
  return {
    currentlyGrowing: [],
    recentlyPlanted: [],
  };
}

function buildWorkspace(
  options: readonly HomeCurationContentOption[],
  selections: readonly HomeCurationSelection[],
): HomeCurationWorkspace {
  const optionById = new Map(options.map((option) => [option.contentId, option]));
  const slots = emptySlots();

  for (const selection of selections) {
    const option = optionById.get(selection.contentId);
    if (!option) continue;
    slots[selection.slot].push({
      ...option,
      slot: selection.slot,
      order: selection.order,
    });
  }

  for (const slot of HOME_CURATION_SLOTS) {
    slots[slot].sort((left, right) => left.order - right.order);
  }

  return { slots, options };
}

function normalizeSelections(
  input: SaveHomeCurationInput,
): HomeCurationSelection[] {
  const seenContentIds = new Set<string>();
  const nextOrder: Record<HomeCurationSlot, number> = {
    currentlyGrowing: 0,
    recentlyPlanted: 0,
  };
  const normalized: HomeCurationSelection[] = [];

  for (const selection of input.selections) {
    if (!isHomeCurationSlot(selection.slot)) {
      throw new HomeCurationInputError("首页精选位置无效。");
    }

    if (!UUID_PATTERN.test(selection.contentId)) {
      throw new HomeCurationInputError("所选内容无效。");
    }

    if (seenContentIds.has(selection.contentId)) {
      throw new HomeCurationInputError(
        "同一内容只能在首页出现一次。",
      );
    }

    seenContentIds.add(selection.contentId);
    normalized.push({
      slot: selection.slot,
      contentId: selection.contentId,
      order: nextOrder[selection.slot],
    });
    nextOrder[selection.slot] += 1;
  }

  return normalized;
}

function selectionsFromRows(
  rows: readonly {
    content_id: string;
    slot: HomeCurationSlot;
    sort_order: number;
  }[],
): HomeCurationSelection[] {
  return rows.map((row) => ({
    contentId: row.content_id,
    slot: row.slot,
    order: row.sort_order,
  }));
}

function assertPublishedSelections(
  selections: readonly HomeCurationSelection[],
  options: readonly HomeCurationContentOption[],
): void {
  const publishedIds = new Set(options.map((option) => option.contentId));
  const unpublished = selections.find(
    (selection) => !publishedIds.has(selection.contentId),
  );

  if (unpublished) {
    throw new HomeCurationInputError(
      "首页精选只能包含已发布内容。",
    );
  }
}

async function createDefaultRepository(): Promise<HomeCurationRepository> {
  try {
    const client = await createClient();
    return createHomeCurationRepository(
      client as unknown as HomeCurationRepositoryClient,
    );
  } catch {
    throw new HomeCurationManagementUnavailableError();
  }
}

export function createHomeCurationManagementService(
  dependencies: HomeCurationManagementServiceDependencies = {},
): HomeCurationManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<HomeCurationRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<HomeCurationRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function getWorkspace(): Promise<HomeCurationWorkspace> {
    await authorize();

    try {
      const repository = await getRepository();
      const [options, rows] = await Promise.all([
        repository.listPublishedContentOptions(),
        repository.listHomeCurationRows(),
      ]);
      return buildWorkspace(options, selectionsFromRows(rows));
    } catch (error) {
      if (error instanceof HomeCurationManagementUnavailableError) throw error;
      if (error instanceof HomeCurationRepositoryError) {
        throw new HomeCurationManagementUnavailableError();
      }
      throw new HomeCurationManagementUnavailableError();
    }
  }

  async function saveHomeCuration(
    input: SaveHomeCurationInput,
  ): Promise<HomeCurationWorkspace> {
    const selections = normalizeSelections(input);
    await authorize();

    try {
      const repository = await getRepository();
      const options = await repository.listPublishedContentOptions();
      assertPublishedSelections(selections, options);
      await repository.replaceHomeCuration(selections);
      return buildWorkspace(options, selections);
    } catch (error) {
      if (error instanceof HomeCurationInputError) throw error;
      if (error instanceof HomeCurationManagementUnavailableError) throw error;
      if (error instanceof HomeCurationRepositoryError) {
        throw new HomeCurationManagementUnavailableError();
      }
      throw new HomeCurationManagementUnavailableError();
    }
  }

  return { getWorkspace, saveHomeCuration };
}

let defaultHomeCurationManagementService:
  | HomeCurationManagementService
  | null = null;

function getDefaultHomeCurationManagementService():
  HomeCurationManagementService {
  defaultHomeCurationManagementService ??=
    createHomeCurationManagementService();
  return defaultHomeCurationManagementService;
}

export function getHomeCurationWorkspace(): Promise<HomeCurationWorkspace> {
  return getDefaultHomeCurationManagementService().getWorkspace();
}

export function saveHomeCuration(
  input: SaveHomeCurationInput,
): Promise<HomeCurationWorkspace> {
  return getDefaultHomeCurationManagementService().saveHomeCuration(input);
}
