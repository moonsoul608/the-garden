import type {
  ContentLanguage,
  ContentType,
  DetailLevel,
  GrowthStage,
  HomeCurationSlot,
  Lifecycle,
  RegionName,
  RelationType,
} from "./content";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Snake-case rows returned by the Phase 02 Supabase content tables. */
export type ContentDatabaseRow = {
  id: string;
  legacy_id: string | null;
  slug: string | null;
  region: RegionName;
  content_type: ContentType;
  detail_level: DetailLevel;
  lifecycle: Lifecycle;
  growth_stage: GrowthStage | null;
  title_zh: string | null;
  title_en: string | null;
  summary_zh: string | null;
  summary_en: string | null;
  body_zh_markdown: string | null;
  body_en_markdown: string | null;
  content_language: ContentLanguage;
  primary_categories: string[];
  cover_image_path: string | null;
  cover_image_alt_zh: string | null;
  cover_image_alt_en: string | null;
  featured: boolean;
  manual_order: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  last_tended_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

/** Public column projection allowed by the Phase 02D grants. */
export type PublicContentDatabaseRow = Omit<
  ContentDatabaseRow,
  "legacy_id" | "created_by" | "updated_by" | "archived_by"
>;

export type ContentDatabaseInsert = {
  id?: string;
  legacy_id?: string | null;
  slug?: string | null;
  region: RegionName;
  content_type: ContentType;
  detail_level: DetailLevel;
  lifecycle?: Lifecycle;
  growth_stage: GrowthStage | null;
  title_zh?: string | null;
  title_en?: string | null;
  summary_zh?: string | null;
  summary_en?: string | null;
  body_zh_markdown?: string | null;
  body_en_markdown?: string | null;
  content_language: ContentLanguage;
  primary_categories?: string[];
  cover_image_path?: string | null;
  cover_image_alt_zh?: string | null;
  cover_image_alt_en?: string | null;
  featured?: boolean;
  manual_order?: number | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  last_tended_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

export type ContentDatabaseUpdate = Partial<ContentDatabaseInsert>;

export type ContentRevisionDatabaseRow = {
  id: string;
  content_id: string;
  lifecycle: "Draft" | "Review";
  slug: string | null;
  region: RegionName;
  content_type: ContentType;
  detail_level: DetailLevel;
  growth_stage: GrowthStage | null;
  title_zh: string | null;
  title_en: string | null;
  summary_zh: string | null;
  summary_en: string | null;
  body_zh_markdown: string | null;
  body_en_markdown: string | null;
  content_language: ContentLanguage;
  primary_categories: string[];
  tags: string[];
  cover_image_path: string | null;
  cover_image_alt_zh: string | null;
  cover_image_alt_en: string | null;
  featured: boolean;
  manual_order: number | null;
  source_version_id: string | null;
  restore_operation_id: string | null;
  restored_by: string | null;
  restored_at: string | null;
  base_content_updated_at: string | null;
  review_submitted_at: string | null;
  review_submitted_by: string | null;
  returned_to_draft_at: string | null;
  returned_to_draft_by: string | null;
  lock_version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

export type ContentRevisionDatabaseInsert = {
  id?: string;
  content_id: string;
  lifecycle?: "Draft" | "Review";
  slug?: string | null;
  region: RegionName;
  content_type: ContentType;
  detail_level: DetailLevel;
  growth_stage: GrowthStage | null;
  title_zh?: string | null;
  title_en?: string | null;
  summary_zh?: string | null;
  summary_en?: string | null;
  body_zh_markdown?: string | null;
  body_en_markdown?: string | null;
  content_language: ContentLanguage;
  primary_categories?: string[];
  tags?: string[];
  cover_image_path?: string | null;
  cover_image_alt_zh?: string | null;
  cover_image_alt_en?: string | null;
  featured?: boolean;
  manual_order?: number | null;
  source_version_id?: string | null;
  restore_operation_id?: string | null;
  restored_by?: string | null;
  restored_at?: string | null;
  base_content_updated_at?: string | null;
  review_submitted_at?: string | null;
  review_submitted_by?: string | null;
  returned_to_draft_at?: string | null;
  returned_to_draft_by?: string | null;
  lock_version?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
};

export type ContentRevisionDatabaseUpdate = Partial<
  Omit<
    ContentRevisionDatabaseInsert,
    | "id"
    | "content_id"
    | "source_version_id"
    | "restore_operation_id"
    | "restored_by"
    | "restored_at"
    | "base_content_updated_at"
    | "review_submitted_at"
    | "review_submitted_by"
    | "returned_to_draft_at"
    | "returned_to_draft_by"
    | "lock_version"
    | "created_at"
    | "created_by"
    | "updated_at"
    | "updated_by"
  >
>;

export type GrowthNoteDatabaseRow = {
  id: string;
  content_id: string;
  from_stage: GrowthStage | null;
  to_stage: GrowthStage;
  note_zh: string | null;
  note_en: string | null;
  occurred_at: string;
  is_public: boolean;
  created_at: string;
};

export type GrowthNoteDatabaseInsert = {
  id?: string;
  content_id: string;
  from_stage?: GrowthStage | null;
  to_stage: GrowthStage;
  note_zh?: string | null;
  note_en?: string | null;
  occurred_at?: string;
  is_public?: boolean;
  created_at?: string;
};

export type GrowthNoteDatabaseUpdate = Partial<GrowthNoteDatabaseInsert>;

export type ContentRelationDatabaseRow = {
  id: string;
  source_content_id: string;
  target_content_id: string;
  relation_type: RelationType;
  note_zh: string | null;
  note_en: string | null;
  created_at: string;
};

export type ContentRelationDatabaseInsert = {
  id?: string;
  source_content_id: string;
  target_content_id: string;
  relation_type: RelationType;
  note_zh?: string | null;
  note_en?: string | null;
  created_at?: string;
};

export type ContentRelationDatabaseUpdate =
  Partial<ContentRelationDatabaseInsert>;

export type HomeCurationDatabaseRow = {
  content_id: string;
  slot: HomeCurationSlot;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type HomeCurationDatabaseInsert = Omit<
  HomeCurationDatabaseRow,
  "created_at" | "updated_at"
> & {
  created_at?: string;
  updated_at?: string;
};

export type HomeCurationDatabaseUpdate =
  Partial<HomeCurationDatabaseInsert>;

export type ContentVersionDatabaseRow = {
  id: string;
  content_id: string;
  snapshot: Json;
  checkpoint_reason: string;
  checkpoint_note: string | null;
  created_at: string;
  created_by: string | null;
  source_revision_id: string | null;
  source_lock_version: number | null;
  archive_operation_id: string | null;
  restore_operation_id: string | null;
  restore_source_version_id: string | null;
  restore_revision_id: string | null;
  restore_archived_token: string | null;
};

export type ContentVersionDatabaseInsert = {
  id?: string;
  content_id: string;
  snapshot: Json;
  checkpoint_reason: string;
  checkpoint_note?: string | null;
  created_at?: string;
  created_by?: string | null;
  source_revision_id?: string | null;
  source_lock_version?: number | null;
  archive_operation_id?: string | null;
  restore_operation_id?: string | null;
  restore_source_version_id?: string | null;
  restore_revision_id?: string | null;
  restore_archived_token?: string | null;
};

export type StorageReferenceOwnerType =
  | "ContentProjection"
  | "ContentRevision"
  | "ContentVersion";

export type StorageObjectLifecycleState =
  | "Referenced"
  | "Unreferenced"
  | "Quarantine"
  | "EligibleForPurge";

export type StorageQuarantineReason =
  | "OrdinaryReplacement"
  | "FailedUpload"
  | "PermanentContentDeletion";

export type StorageObjectReferenceDatabaseRow = {
  id: string;
  object_path: string;
  bucket: string;
  reference_owner_type: StorageReferenceOwnerType;
  reference_owner_id: string;
  content_id: string | null;
  reference_state: "Referenced";
  created_at: string;
  updated_at: string;
};

export type StorageObjectReferenceDatabaseInsert = {
  id?: string;
  object_path: string;
  bucket: string;
  reference_owner_type: StorageReferenceOwnerType;
  reference_owner_id: string;
  content_id?: string | null;
  reference_state?: "Referenced";
  created_at?: string;
  updated_at?: string;
};

export type StorageObjectLifecycleDatabaseRow = {
  bucket: string;
  object_path: string;
  lifecycle_state: StorageObjectLifecycleState;
  last_referenced_at: string | null;
  unreferenced_at: string | null;
  quarantine_started_at: string | null;
  quarantine_until: string | null;
  quarantine_reason: StorageQuarantineReason | null;
  created_at: string;
  updated_at: string;
};

export type StorageObjectLifecycleDatabaseInsert = {
  bucket: string;
  object_path: string;
  lifecycle_state: StorageObjectLifecycleState;
  last_referenced_at?: string | null;
  unreferenced_at?: string | null;
  quarantine_started_at?: string | null;
  quarantine_until?: string | null;
  quarantine_reason?: StorageQuarantineReason | null;
  created_at?: string;
  updated_at?: string;
};

export type TagDatabaseRow = {
  id: string;
  normalized_name: string;
  display_name: string;
  created_at: string;
};

export type TagDatabaseInsert = Omit<TagDatabaseRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type TagDatabaseUpdate = Partial<TagDatabaseInsert>;

export type ContentTagDatabaseRow = {
  content_id: string;
  tag_id: string;
};

export type ContentTagDatabaseInsert = ContentTagDatabaseRow;
export type ContentTagDatabaseUpdate = Partial<ContentTagDatabaseRow>;

type SupabaseTable<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Generated-style database slice used by the content service boundary. */
export type ContentDatabase = {
  public: {
    Tables: {
      contents: SupabaseTable<
        ContentDatabaseRow,
        ContentDatabaseInsert,
        ContentDatabaseUpdate
      >;
      content_revisions: SupabaseTable<
        ContentRevisionDatabaseRow,
        ContentRevisionDatabaseInsert,
        ContentRevisionDatabaseUpdate
      >;
      content_versions: SupabaseTable<
        ContentVersionDatabaseRow,
        ContentVersionDatabaseInsert,
        never
      >;
      storage_object_references: SupabaseTable<
        StorageObjectReferenceDatabaseRow,
        StorageObjectReferenceDatabaseInsert,
        never
      >;
      storage_object_lifecycles: SupabaseTable<
        StorageObjectLifecycleDatabaseRow,
        StorageObjectLifecycleDatabaseInsert,
        never
      >;
      growth_notes: SupabaseTable<
        GrowthNoteDatabaseRow,
        GrowthNoteDatabaseInsert,
        GrowthNoteDatabaseUpdate
      >;
      content_relations: SupabaseTable<
        ContentRelationDatabaseRow,
        ContentRelationDatabaseInsert,
        ContentRelationDatabaseUpdate
      >;
      tags: SupabaseTable<
        TagDatabaseRow,
        TagDatabaseInsert,
        TagDatabaseUpdate
      >;
      content_tags: SupabaseTable<
        ContentTagDatabaseRow,
        ContentTagDatabaseInsert,
        ContentTagDatabaseUpdate
      >;
      home_curation: SupabaseTable<
        HomeCurationDatabaseRow,
        HomeCurationDatabaseInsert,
        HomeCurationDatabaseUpdate
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_user_is_garden_keeper: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      create_content_draft: {
        Args: { p_draft: Json };
        Returns: ContentRevisionDatabaseRow;
      };
      start_content_draft_revision: {
        Args: { p_content_id: string };
        Returns: ContentRevisionDatabaseRow;
      };
      publish_review_revision: {
        Args: {
          p_content_id: string;
          p_revision_id: string;
          p_expected_lock_version: number;
        };
        Returns: Json;
      };
      archive_published_content: {
        Args: {
          p_content_id: string;
          p_expected_updated_at: string;
          p_operation_id: string;
        };
        Returns: Json;
      };
      restore_version_to_draft: {
        Args: {
          p_content_id: string;
          p_source_version_id: string;
          p_expected_archived_token: string;
          p_operation_id: string;
        };
        Returns: Json;
      };
      preview_archived_content_deletion: {
        Args: { p_content_id: string };
        Returns: Json;
      };
      delete_archived_content: {
        Args: {
          p_content_id: string;
          p_expected_archived_token: string;
          p_impact_digest: string;
          p_operation_id: string;
        };
        Returns: Json;
      };
      inspect_storage_object_purge_safety: {
        Args: {
          p_bucket: string;
          p_object_path: string;
        };
        Returns: Json;
      };
      quarantine_failed_storage_upload: {
        Args: {
          p_bucket: string;
          p_object_path: string;
          p_grace_period: string;
        };
        Returns: Json;
      };
      mark_storage_object_post_delete_bypass: {
        Args: {
          p_bucket: string;
          p_object_path: string;
        };
        Returns: Json;
      };
      list_keeper_media_workspace: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      create_route_redirect: {
        Args: {
          p_source_route: string;
          p_target_route: string;
          p_redirect_type: string;
          p_reason: string | null;
        };
        Returns: Json;
      };
      resolve_public_content_route: {
        Args: {
          p_region: RegionName;
          p_slug: string;
        };
        Returns: Json;
      };
      filter_unmigrated_public_routes: {
        Args: { p_routes: Json };
        Returns: Json;
      };
    };
    Enums: {
      garden_region: RegionName;
      content_type: ContentType;
      detail_level: DetailLevel;
      content_lifecycle: Lifecycle;
      growth_stage: GrowthStage;
      content_language: ContentLanguage;
      relation_type: RelationType;
      home_slot: HomeCurationSlot;
      storage_reference_owner_type: StorageReferenceOwnerType;
      storage_reference_state: "Referenced";
      storage_object_lifecycle_state: StorageObjectLifecycleState;
      storage_quarantine_reason: StorageQuarantineReason;
    };
    CompositeTypes: Record<string, never>;
  };
};
