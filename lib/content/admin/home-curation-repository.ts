import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { HomeCurationSlot, Lifecycle } from "@/types";
import type {
  ContentDatabase,
  ContentDatabaseRow,
  HomeCurationDatabaseInsert,
  HomeCurationDatabaseRow,
} from "@/types/database";

import type {
  HomeCurationContentOption,
  HomeCurationSelection,
} from "./home-curation-contracts";
import { HOME_CURATION_SLOTS } from "./home-curation-contracts";

const PUBLISHED_CONTENT_COLUMNS = [
  "id",
  "title_zh",
  "title_en",
  "region",
  "growth_stage",
  "updated_at",
].join(",");

const HOME_CURATION_COLUMNS = [
  "content_id",
  "slot",
  "sort_order",
  "created_at",
  "updated_at",
].join(",");

type PublishedContentRow = Pick<
  ContentDatabaseRow,
  "id" | "title_zh" | "title_en" | "region" | "growth_stage" | "updated_at"
>;

export class HomeCurationRepositoryError extends Error {
  constructor() {
    super("首页精选数据无法完成请求。");
    this.name = "HomeCurationRepositoryError";
  }
}

export interface HomeCurationRepository {
  listPublishedContentOptions(): Promise<HomeCurationContentOption[]>;
  listHomeCurationRows(): Promise<HomeCurationDatabaseRow[]>;
  replaceHomeCuration(selections: readonly HomeCurationSelection[]): Promise<void>;
}

type HomeCurationRepositoryClient = SupabaseClient<ContentDatabase>;

function preferredTitle(row: PublishedContentRow): string {
  return row.title_en?.trim() || row.title_zh?.trim() || "未命名";
}

function mapContentOption(row: PublishedContentRow): HomeCurationContentOption {
  return {
    contentId: row.id,
    title: preferredTitle(row),
    region: row.region,
    growthStage: row.growth_stage,
    updatedAt: row.updated_at,
  };
}

export function createHomeCurationRepository(
  client: HomeCurationRepositoryClient,
): HomeCurationRepository {
  async function listPublishedContentOptions(): Promise<
    HomeCurationContentOption[]
  > {
    const publishedLifecycle: Lifecycle = "Published";
    const result = await client
      .from("contents")
      .select(PUBLISHED_CONTENT_COLUMNS)
      .eq("lifecycle", publishedLifecycle)
      .order("region", { ascending: true })
      .order("title_en", { ascending: true });

    if (result.error) throw new HomeCurationRepositoryError();
    return ((result.data ?? []) as unknown as PublishedContentRow[]).map(
      mapContentOption,
    );
  }

  async function listHomeCurationRows(): Promise<HomeCurationDatabaseRow[]> {
    const result = await client
      .from("home_curation")
      .select(HOME_CURATION_COLUMNS)
      .order("slot", { ascending: true })
      .order("sort_order", { ascending: true });

    if (result.error) throw new HomeCurationRepositoryError();
    return (result.data ?? []) as unknown as HomeCurationDatabaseRow[];
  }

  async function replaceHomeCuration(
    selections: readonly HomeCurationSelection[],
  ): Promise<void> {
    const deleteResult = await client
      .from("home_curation")
      .delete()
      .in("slot", [...HOME_CURATION_SLOTS] as HomeCurationSlot[]);

    if (deleteResult.error) throw new HomeCurationRepositoryError();
    if (selections.length === 0) return;

    const rows: HomeCurationDatabaseInsert[] = selections.map((selection) => ({
      content_id: selection.contentId,
      slot: selection.slot,
      sort_order: selection.order,
    }));
    const insertResult = await client.from("home_curation").insert(rows);

    if (insertResult.error) throw new HomeCurationRepositoryError();
  }

  return {
    listPublishedContentOptions,
    listHomeCurationRows,
    replaceHomeCuration,
  };
}

export type { HomeCurationRepositoryClient };
