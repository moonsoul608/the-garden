export type RegionName = "Garden" | "Forest" | "Lake" | "Ruins";
export type SiteRegionName = "Home" | RegionName | "Greenhouse";
export type ContentType = "Seed" | "Question" | "Reflection" | "Trace";
export type GrowthStage = "Seed" | "Sprout" | "Growing" | "Bloom" | "Dormant";
export type GrowthStatus = GrowthStage;
export type DetailLevel = "full" | "short";
export type ContentLanguage = "zh" | "en" | "bilingual" | "mixed";
export type Lifecycle = "Draft" | "Review" | "Published" | "Archived";
export type RelationType = "grewFrom" | "grewInto" | "relatedTo";
export type HomeCurationSlot = "currentlyGrowing" | "recentlyPlanted";

export type CoverMetadata = {
  path: string;
  altZh: string | null;
  altEn: string | null;
};

/** Canonical application model. Database rows are mapped into this shape. */
export type ContentRecord = {
  id: string;
  legacyId: string | null;
  slug: string | null;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  lifecycle: Lifecycle;
  growthStage: GrowthStage;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  bodyZhMarkdown: string | null;
  bodyEnMarkdown: string | null;
  contentLanguage: ContentLanguage;
  primaryCategories: string[];
  tags: string[];
  cover: CoverMetadata | null;
  featured: boolean;
  manualOrder: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  lastTendedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
};

export type GrowthNote = {
  id: string;
  contentId: string;
  fromStage: GrowthStage | null;
  toStage: GrowthStage;
  noteZh: string | null;
  noteEn: string | null;
  occurredAt: string;
  isPublic: boolean;
  createdAt: string;
};

export type ContentRelation = {
  id: string;
  sourceContentId: string;
  targetContentId: string;
  relationType: RelationType;
  noteZh: string | null;
  noteEn: string | null;
  createdAt: string;
};

export type HomeCurationItem = {
  contentId: string;
  slot: HomeCurationSlot;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** Minimal serializable shape consumed by public collection components. */
export type PublicContentCard = {
  id: string;
  slug: string;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  /** Null only while a legacy source has no confirmed Growth Stage. */
  growthStage: GrowthStage | null;
  /** Null only while legacy bilingual field mapping remains unconfirmed. */
  contentLanguage: ContentLanguage | null;
  title: string;
  summary: string;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  primaryCategories: string[];
  tags: string[];
  cover: CoverMetadata | null;
  featured: boolean;
  manualOrder: number | null;
  publishedAt: string | null;
  lastTendedAt: string | null;
};

export type PublicContentRelation = {
  id: string;
  relationType: RelationType;
  noteZh: string | null;
  noteEn: string | null;
  target: Pick<
    PublicContentCard,
    "id" | "slug" | "region" | "contentType" | "growthStage" | "title"
  >;
};

export type PublicGrowthNote = Pick<
  GrowthNote,
  "id" | "fromStage" | "toStage" | "noteZh" | "noteEn" | "occurredAt"
>;

export type PublicContentDetail = PublicContentCard & {
  bodyMarkdown: string;
  bodyZhMarkdown: string | null;
  bodyEnMarkdown: string | null;
  growthTimeline: PublicGrowthNote[];
  relations: PublicContentRelation[];
};

export type PublicArchivedRelation = {
  relationType: RelationType;
  target: {
    slug: string;
    region: RegionName;
    growthStage: GrowthStage;
    title: string;
  };
};

/** Deliberately limited payload for an Archived route resting state. */
export type PublicArchivedContent = {
  title: string;
  region: RegionName;
  growthStage: GrowthStage;
  lifecycle: "Archived";
  restingState: "archived";
  relations: PublicArchivedRelation[];
};

export type PublicContentRouteDisposition =
  | { kind: "published"; content: PublicContentDetail }
  | { kind: "archived"; content: PublicArchivedContent }
  | { kind: "not_found" };

export type PublicHomeCurationItem = {
  slot: HomeCurationSlot;
  order: number;
  content: PublicContentCard;
};

export type AdminContentRecord = ContentRecord & {
  growthNotes: GrowthNote[];
  outgoingRelations: ContentRelation[];
  incomingRelations: ContentRelation[];
};

export type ContentQuery = {
  regions?: RegionName[];
  contentTypes?: ContentType[];
  growthStages?: GrowthStage[];
  lifecycles?: Lifecycle[];
  primaryCategories?: string[];
  tags?: string[];
  search?: string;
  featured?: boolean;
  orderBy?: "lastTendedAt" | "publishedAt" | "manualOrder";
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type V1MigrationIssueCode =
  | "missing_growth_stage"
  | "missing_required_field"
  | "invalid_value"
  | "duplicate_identity"
  | "duplicate_route"
  | "duplicate_relation"
  | "self_relation"
  | "unresolved_relation"
  | "unsupported_relation";

export type V1MigrationIssue = {
  code: V1MigrationIssueCode;
  severity: "blocked" | "warning";
  legacyId: string | null;
  field: string | null;
  message: string;
};

/**
 * A migration candidate may have no Growth Stage so extraction can report the
 * known Lake gap without guessing a value. It is never a valid ContentRecord
 * until that issue is resolved explicitly.
 */
export type V1MigrationContentRecord = {
  legacyId: string;
  slug: string;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  lifecycle: "Published";
  growthStage: GrowthStage | null;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  bodyZhMarkdown: string | null;
  bodyEnMarkdown: string | null;
  contentLanguage: ContentLanguage;
  primaryCategories: string[];
  tags: string[];
  cover: CoverMetadata | null;
  featured: false;
  manualOrder: null;
  publishedAt: null;
  archivedAt: null;
  lastTendedAt: null;
};

export type V1MigrationRelation = {
  sourceLegacyId: string;
  targetLegacyId: string;
  relationType: "grewInto";
  noteZh: string | null;
  noteEn: string | null;
};

export type V1MigrationHomeCurationItem = {
  contentLegacyId: string;
  slot: HomeCurationSlot;
  order: number;
};

export type V1MigrationTag = {
  normalizedName: string;
  displayName: string;
};

export type V1MigrationContentTag = {
  contentLegacyId: string;
  tagNormalizedName: string;
};

export type V1MigrationSiteCopyItem = {
  copyKey: string;
  locale: "zh" | "en";
  copyGroup: string;
  copyValue: string;
};

export type V1MigrationCompatibilityWarning = {
  code:
    | "home_curation_deferred"
    | "site_copy_deferred"
    | "display_overrides_deferred"
    | "related_paths_not_migrated";
  legacyId: string | null;
  message: string;
};

/** `homeCuration` remains empty until its deferred conflicts are resolved. */
export type V1MigrationBundle = {
  schemaVersion: 1;
  source: "v1-static-typescript";
  status: "ready" | "blocked";
  contents: V1MigrationContentRecord[];
  relations: V1MigrationRelation[];
  tags: V1MigrationTag[];
  contentTags: V1MigrationContentTag[];
  homeCuration: V1MigrationHomeCurationItem[];
  siteCopy: V1MigrationSiteCopyItem[];
  compatibilityWarnings: V1MigrationCompatibilityWarning[];
  issues: V1MigrationIssue[];
};

export type ContentItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  status?: GrowthStatus;
  categories: string[];
  tags?: string[];
  plantedOn?: string;
  lastTended?: string;
  cta: string;
  image?: string;
};

export type GardenItem = ContentItem & { region: "Garden"; contentType: "Seed"; beds: string[] };
export type ForestItem = ContentItem & { region: "Forest"; contentType: "Question"; trails: string[] };
export type LakeItem = ContentItem & {
  region: "Lake";
  contentType: "Reflection";
  reflectionType: string;
  reason: string;
};
export type RuinsItem = ContentItem & {
  region: "Ruins";
  contentType: "Trace";
  traceType: string;
  grewInto?: string;
};

export type SeedResult = {
  seedName: string;
  coreQuestion: string;
  suggestedRegion: "Garden" | "Forest";
  growthStage: "Seed" | "Sprout";
  pathsToExplore: [string, string, string];
  firstStep: string;
};
