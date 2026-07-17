import type {
  ContentDatabaseRow,
  ContentRelationDatabaseRow,
  GrowthNoteDatabaseRow,
  HomeCurationDatabaseRow,
  PublicContentDatabaseRow,
} from "@/types/database";
import type {
  ContentRecord,
  ContentRelation,
  GrowthNote,
  PublicContentCard,
  PublicContentDetail,
  PublicContentRelation,
  PublicHomeCurationItem,
} from "@/types";

import { ContentMappingError } from "./errors";

export type PreferredLanguage = "zh" | "en";

export type RepositoryRelation = {
  relation: ContentRelationDatabaseRow;
  target: PublicContentDatabaseRow;
};

export function getBilingualValue(
  zh: string | null,
  en: string | null,
  preferredLanguage: PreferredLanguage = "zh",
): string | null {
  const primary = preferredLanguage === "zh" ? zh : en;
  const fallback = preferredLanguage === "zh" ? en : zh;

  return primary?.trim() || fallback?.trim() || null;
}

export function requireBilingualValue(
  zh: string | null,
  en: string | null,
  field: string,
  preferredLanguage: PreferredLanguage = "zh",
): string {
  const value = getBilingualValue(zh, en, preferredLanguage);

  if (!value) {
    throw new ContentMappingError(field);
  }

  return value;
}

export function mapContentDatabaseRow(
  row: ContentDatabaseRow | PublicContentDatabaseRow,
  tags: string[] = [],
): ContentRecord {
  const hasPrivateColumns = "legacy_id" in row;

  return {
    id: row.id,
    legacyId: hasPrivateColumns ? row.legacy_id : null,
    slug: row.slug,
    region: row.region,
    contentType: row.content_type,
    detailLevel: row.detail_level,
    lifecycle: row.lifecycle,
    growthStage: row.growth_stage,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    summaryZh: row.summary_zh,
    summaryEn: row.summary_en,
    bodyZhMarkdown: row.body_zh_markdown,
    bodyEnMarkdown: row.body_en_markdown,
    contentLanguage: row.content_language,
    primaryCategories: [...row.primary_categories],
    tags: [...tags],
    cover: row.cover_image_path
      ? {
          path: row.cover_image_path,
          altZh: row.cover_image_alt_zh,
          altEn: row.cover_image_alt_en,
        }
      : null,
    featured: row.featured,
    manualOrder: row.manual_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    lastTendedAt: row.last_tended_at,
    createdBy: hasPrivateColumns ? row.created_by : null,
    updatedBy: hasPrivateColumns ? row.updated_by : null,
  };
}

export function mapGrowthNoteDatabaseRow(
  row: GrowthNoteDatabaseRow,
): GrowthNote {
  return {
    id: row.id,
    contentId: row.content_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    noteZh: row.note_zh,
    noteEn: row.note_en,
    occurredAt: row.occurred_at,
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

export function mapContentRelationDatabaseRow(
  row: ContentRelationDatabaseRow,
): ContentRelation {
  return {
    id: row.id,
    sourceContentId: row.source_content_id,
    targetContentId: row.target_content_id,
    relationType: row.relation_type,
    noteZh: row.note_zh,
    noteEn: row.note_en,
    createdAt: row.created_at,
  };
}

export function mapContentRecordToPublicCard(
  content: ContentRecord,
  preferredLanguage: PreferredLanguage = "zh",
): PublicContentCard {
  if (!content.slug) {
    throw new ContentMappingError("slug");
  }

  return {
    slug: content.slug,
    region: content.region,
    contentType: content.contentType,
    detailLevel: content.detailLevel,
    growthStage: content.growthStage,
    contentLanguage: content.contentLanguage,
    title: requireBilingualValue(
      content.titleZh,
      content.titleEn,
      "title",
      preferredLanguage,
    ),
    summary: requireBilingualValue(
      content.summaryZh,
      content.summaryEn,
      "summary",
      preferredLanguage,
    ),
    titleZh: content.titleZh,
    titleEn: content.titleEn,
    summaryZh: content.summaryZh,
    summaryEn: content.summaryEn,
    primaryCategories: [...content.primaryCategories],
    tags: [...content.tags],
    cover: content.cover ? { ...content.cover } : null,
    featured: content.featured,
    publishedAt: content.publishedAt,
    lastTendedAt: content.lastTendedAt,
  };
}

export function mapContentRecordToPublicDetail(
  content: ContentRecord,
  growthNotes: GrowthNote[] = [],
  relations: PublicContentRelation[] = [],
  preferredLanguage: PreferredLanguage = "zh",
): PublicContentDetail {
  return {
    ...mapContentRecordToPublicCard(content, preferredLanguage),
    bodyMarkdown: requireBilingualValue(
      content.bodyZhMarkdown,
      content.bodyEnMarkdown,
      "body Markdown",
      preferredLanguage,
    ),
    bodyZhMarkdown: content.bodyZhMarkdown,
    bodyEnMarkdown: content.bodyEnMarkdown,
    growthTimeline: growthNotes
      .filter((note) => note.isPublic)
      .map(({ fromStage, toStage, noteZh, noteEn, occurredAt }) => ({
        fromStage,
        toStage,
        noteZh,
        noteEn,
        occurredAt,
      })),
    relations,
  };
}

export function mapRepositoryRelationToPublic(
  relation: RepositoryRelation,
  preferredLanguage: PreferredLanguage = "zh",
): PublicContentRelation {
  const target = mapContentRecordToPublicCard(
    mapContentDatabaseRow(relation.target),
    preferredLanguage,
  );

  return {
    relationType: relation.relation.relation_type,
    noteZh: relation.relation.note_zh,
    noteEn: relation.relation.note_en,
    target: {
      slug: target.slug,
      region: target.region,
      contentType: target.contentType,
      growthStage: target.growthStage,
      title: target.title,
    },
  };
}

export function mapHomeCurationToPublic(
  row: HomeCurationDatabaseRow,
  content: ContentRecord,
  preferredLanguage: PreferredLanguage = "zh",
): PublicHomeCurationItem {
  return {
    slot: row.slot,
    order: row.sort_order,
    content: mapContentRecordToPublicCard(content, preferredLanguage),
  };
}
