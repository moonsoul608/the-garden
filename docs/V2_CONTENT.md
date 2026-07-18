# The Garden — Version 2 Content Specification

## 1. Document purpose

This document defines the editable content model, language rules, lifecycle rules, and visitor-facing content boundaries for The Garden Version 2.

It does not replace the confirmed Version 1 visitor-facing copy.

Unless a Version 2 copy change is explicitly approved:

- existing Version 1 public copy remains the baseline;
- existing titles, summaries, and detail content must be migrated without rewriting;
- no new personal experiences, projects, achievements, preferences, trauma, diagnoses, grades, dates, or contact details may be invented.

---

## 2. Content inventory

The Version 1 Initial Garden contains:

- 5 Garden Seeds;
- 5 Forest Questions;
- 5 Lake Reflections;
- 4 Ruins Traces.

Version 2 supports dynamic creation of additional:

- Seed;
- Question;
- Reflection;
- Trace.

The 19 Version 1 items are migration seed data, not a permanent maximum.

---

## 3. Fixed content concepts

### 3.1 Regions

Allowed public content Regions:

- `Garden`
- `Forest`
- `Lake`
- `Ruins`

Home and Greenhouse are product Regions but do not own ordinary public content items in the same content collection.

### 3.2 Content Types

Allowed values:

- `Seed`
- `Question`
- `Reflection`
- `Trace`

Recommended mapping:

- Garden → Seed
- Forest → Question
- Lake → Reflection
- Ruins → Trace

Version 2 must not add another Content Type without a later specification change.

### 3.3 Growth Stages

Allowed values:

- `Seed`
- `Sprout`
- `Growing`
- `Bloom`
- `Dormant`

Growth Stage is manually selected where it applies:

- Garden Seeds, Forest Questions, and Ruins Traces require a Growth Stage.
- Lake Reflections may use `null`, meaning "not growth-tracked / not applicable."
- `null` is not a new enum value; the existing enum remains unchanged.

### 3.4 Lifecycle

Allowed editable lifecycle values:

- `Draft`
- `Review`
- `Published`
- `Archived`

Permanent deletion is an action available only from Archived.

### 3.5 Detail Level

Keep:

- `full`
- `short`

The system may use shared templates, but every Published item must have a valid public detail route.

---

## 4. Recommended content record

The exact database implementation may vary, but it must preserve the following contract.

```ts
type RegionName = "Garden" | "Forest" | "Lake" | "Ruins";

type ContentType = "Seed" | "Question" | "Reflection" | "Trace";

type GrowthStage =
  | "Seed"
  | "Sprout"
  | "Growing"
  | "Bloom"
  | "Dormant";

type Lifecycle =
  | "Draft"
  | "Review"
  | "Published"
  | "Archived";

type DetailLevel = "full" | "short";

type ContentLanguage =
  | "zh"
  | "en"
  | "bilingual"
  | "mixed";

type ContentItem = {
  id: string;
  slug: string;

  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;

  lifecycle: Lifecycle;
  growthStage: GrowthStage | null;

  titleZh?: string;
  titleEn?: string;
  summaryZh?: string;
  summaryEn?: string;
  bodyZhMarkdown?: string;
  bodyEnMarkdown?: string;
  contentLanguage: ContentLanguage;

  primaryCategories: string[];
  tags: string[];

  coverImagePath?: string;
  coverImageAltZh?: string;
  coverImageAltEn?: string;

  featured: boolean;
  manualOrder?: number;

  createdAt: string;
  publishedAt?: string;
  lastTendedAt: string;
  archivedAt?: string;

  createdBy: string;
  updatedBy: string;
};
```

Implementation may normalize bilingual body fields differently, but Garden Keeper must allow the administrator to choose and edit Chinese and English content fields without requiring both.

---

## 5. Required fields by lifecycle

### 5.1 Draft

Minimum:

- one title field;
- Region;
- Content Type;
- Growth Stage where applicable;
- lifecycle = Draft.

Draft may have incomplete summary or body.

### 5.2 Review

Required:

- one title field;
- one summary field;
- Region;
- Content Type;
- Growth Stage where applicable;
- valid slug proposal;
- selected primary category where required;
- valid Markdown body or a confirmed short-detail explanation;
- cover alt text when a cover exists.

### 5.3 Published

Required:

- all Review requirements;
- unique stable slug;
- publication timestamp;
- valid public route;
- no broken relation targets;
- no missing required image alt;
- no private-only copy accidentally exposed.

### 5.4 Archived

Archived content retains:

- identity;
- slug;
- Region;
- title;
- final Growth Stage, where applicable;
- Growth Notes;
- relations;
- version history;
- cover reference until permanent deletion.

Archived content does not appear in public discovery collections.

---

## 6. Slug and identity rules

- `id` is the stable internal identity.
- `slug` is the stable public path segment after first publication.
- changing a title does not change the slug;
- duplicate slugs in the same Region are forbidden;
- Region changes require a redirect record;
- deleted slugs must not be silently reused;
- imported Version 1 slugs must remain unchanged.

---

## 7. Bilingual content rules

### 7.1 Content may be incomplete in one language

Allowed:

- Chinese only;
- English only;
- bilingual;
- intentionally mixed.

Do not require automatic translation.

### 7.2 Preferred display fallback

For a Chinese-primary page:

1. Chinese field;
2. English field;
3. validation error when neither exists.

For metadata, use the best available title and summary.

### 7.3 Search fields

Search must include:

- `titleZh`;
- `titleEn`;
- `summaryZh`;
- `summaryEn`;
- tags;
- primary categories.

Full-body search is not required in V2.

### 7.4 Language markup

Public rendering should apply appropriate language metadata where practical:

- page-level default remains compatible with the current Chinese-primary site;
- locally English-only sections may use `lang="en"`;
- mixed content must remain readable to assistive technology.

---

## 8. Fixed primary taxonomy

### 8.1 Garden Beds

- Psychology
- AI
- Coding
- Design & Making

### 8.2 Forest Trails

Keep the confirmed Version 1 values.

### 8.3 Lake Ripples

Keep the confirmed Version 1 values.

### 8.4 Ruins Trace Types

Keep the confirmed Version 1 values.

These primary categories are selected in Garden Keeper but not created or renamed there in V2.

---

## 9. Free tags

Tags are optional.

Rules:

- free text;
- trimmed and normalized;
- duplicate variants should be avoided;
- tags do not define navigation;
- tags do not create Regions;
- tags support Index and Search;
- no hierarchical tag system in V2.

---

## 10. Growth Notes

Recommended contract:

```ts
type GrowthNote = {
  id: string;
  contentId: string;
  fromStage?: GrowthStage;
  toStage: GrowthStage;
  noteZh?: string;
  noteEn?: string;
  occurredAt: string;
  isPublic: boolean;
  createdAt: string;
};
```

Rules:

- a Growth Stage change requires a Growth Note;
- one note field must be present;
- notes may remain private;
- public notes form the Growth Timeline;
- ordinary body edits do not create Growth Notes;
- changing lifecycle does not automatically change Growth Stage.

---

## 11. Public Growth Timeline

A detail page may show selected public Growth Notes.

Display:

- Growth Stage;
- date;
- one concise note.

Do not show:

- autosave history;
- internal review comments;
- private Growth Notes;
- raw version diffs;
- administrator identity.

---

## 12. Relations

Allowed relation types:

```ts
type RelationType =
  | "grewFrom"
  | "grewInto"
  | "relatedTo";
```

Recommended contract:

```ts
type ContentRelation = {
  id: string;
  sourceContentId: string;
  targetContentId: string;
  relationType: RelationType;
  noteZh?: string;
  noteEn?: string;
  createdAt: string;
};
```

Rules:

- targets must be existing content items;
- relations are manually selected;
- no AI-generated relation is accepted automatically;
- no arbitrary external URL relation;
- self-relations are forbidden;
- duplicate identical relations are forbidden;
- public display must remain concise;
- archived targets may be shown only with an appropriate resting-state label;
- deleting a target requires an impact warning and relation cleanup.

Version 1 Ruins `grewInto` data must migrate into this model.

---

## 13. Cover image

Each content item supports zero or one cover image.

Required metadata:

- Storage path or approved public URL;
- alt text in the primary content language;
- optional alt text in the second language.

Rules:

- image is optional;
- content without an image keeps the existing text-first presentation;
- publication is blocked when an image exists but required alt text is empty;
- no inline media library;
- no gallery;
- no multiple-image field;
- no image wall;
- cards must remain readable without images.

---

## 14. Versions

Recommended snapshot content:

- title fields;
- summary fields;
- body Markdown fields;
- Region;
- Content Type;
- Growth Stage;
- categories;
- tags;
- cover reference;
- lifecycle at snapshot time;
- saved timestamp;
- optional checkpoint note.

Rules:

- keep the latest 10;
- autosave does not create a snapshot;
- publish creates a snapshot;
- explicit checkpoint creates a snapshot;
- restore preserves the current state as a new snapshot first;
- permanent deletion removes snapshots.

---

## 15. Home curation content

Home uses references to canonical content records.

Recommended curation contract:

```ts
type HomeCurationSlot =
  | "currentlyGrowing"
  | "recentlyPlanted";

type HomeCurationItem = {
  contentId: string;
  slot: HomeCurationSlot;
  order: number;
};
```

### Currently Growing

- 3–4 items;
- actively being tended;
- usually Sprout or Growing;
- manually confirmed.

### Recently Planted

- maximum 2 items;
- recently Published;
- manually confirmed from system suggestions.

Rules:

- no duplicate item across both slots;
- titles, summaries, status, and URLs come from the canonical content record;
- no automatic latest-post feed;
- no view-count-based selection.

---

## 16. Featured content

Each content item may be Featured within its Region.

Rules:

- manually selected;
- maximum 3 per Region;
- independent of Home curation;
- no automatic popularity logic;
- no AI selection;
- public indicator must not be confused with Saved Paths.

---

## 17. Public ordering

Region default ordering:

1. Featured;
2. manual order when configured;
3. Growth Stage priority;
4. `lastTendedAt` descending.

Suggested Growth priority:

1. Bloom
2. Growing
3. Sprout
4. Seed
5. Dormant

Garden Index default:

- recently tended.

Search:

- query relevance first.

---

## 18. Markdown import

Support one file per import.

Recommended frontmatter subset:

```yaml
---
titleZh:
titleEn:
summaryZh:
summaryEn:
region:
contentType:
growthStage:
contentLanguage:
primaryCategories:
tags:
---
```

Rules:

- imported content becomes Draft;
- unknown frontmatter keys are ignored or reported safely;
- invalid Region, Content Type, or Growth Stage blocks import;
- import does not publish;
- import does not create Home curation;
- import does not create relations automatically;
- no folder or vault sync.

---

## 19. Export

### 19.1 JSON

May include:

- content;
- tags;
- categories;
- growth notes;
- relations;
- lifecycle;
- timestamps;
- cover reference;
- optional versions.

### 19.2 Markdown

Each exported item should contain:

- selected title;
- summary;
- Markdown body;
- frontmatter for Region, Content Type, Growth Stage, tags, and dates;
- optional public Growth Timeline;
- optional relation references.

### 19.3 Export filters

Allow:

- Published only;
- include Draft;
- include Archived.

Do not automatically commit exports to GitHub.

---

## 20. Editable site copy

Garden Keeper may edit only approved fixed-copy keys.

Recommended groups:

### Home

- welcome body;
- About body;
- Currently Growing description;
- Recently Planted description;
- closing copy.

### Regions

- Region introductory description;
- selected ending text.

### Footer

- explanatory line;
- Leave a note invitation.

### Selected CTA labels

Only keys explicitly listed in the settings schema.

Not editable through Garden Keeper:

- Region names;
- route names;
- map structure;
- page section order;
- component labels needed for accessibility;
- security and destructive-action warnings;
- raw technical error messages.

Existing Version 1 copy remains the default seed data.

---

## 21. Greenhouse configuration content

Garden Keeper may edit:

- system instruction text;
- tone guidance;
- structured-output guidance that remains compatible with code validation;
- example input;
- example output;
- approved recommendation wording.

Code remains authoritative for:

- allowed Regions;
- allowed Growth Stages;
- exact required output schema;
- timeout;
- error mapping;
- provider;
- model;
- API key.

Admin configuration must not be able to relax validation or expose secrets.

---

## 22. Visitor notes

Recommended contract:

```ts
type VisitorNote = {
  id: string;
  name?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};
```

Rules:

- message required;
- name optional;
- private by default;
- no email required;
- no public display in V2;
- no reply thread;
- rate limited;
- sanitized;
- deletable by Garden Keeper.

Exact new public form copy must be reviewed before implementation.

---

## 23. Local visitor data

### 23.1 Saved Paths

Store only:

- content ID or stable route;
- saved timestamp.

Visual state:

- not saved: outlined star;
- saved: filled yellow star.

Accessibility:

- `aria-pressed`;
- text alternative;
- visible focus;
- save/remove announcement.

### 23.2 Recently Visited

Store only:

- content ID or stable route;
- last visited timestamp.

Maximum:

- 5–10 items.

Both features:

- remain local to the current browser;
- are manually clearable;
- do not enter analytics as identity-bearing records;
- do not sync across devices.

---

## 24. Analytics event vocabulary

Allowed aggregate event categories:

- `page_view`
- `region_view`
- `content_view`
- `greenhouse_use`
- `note_submit`
- `share_click`

Do not store:

- name;
- email;
- authenticated visitor identity;
- IP address;
- full navigation history;
- cross-site identifier.

Prefer daily aggregate counts or minimal anonymous events that can be aggregated and expired.

---

## 25. Archived public content

Direct access to an Archived route may show:

- original title;
- owning Region;
- final Growth Stage, or an intentional not-growth-tracked state for Lake Reflections;
- resting-state explanation;
- return path;
- approved related paths.

Do not show:

- full body by default;
- Draft content;
- internal notes;
- admin controls;
- raw deletion reason.

Archived content must be:

- excluded from Search;
- excluded from Index;
- excluded from Home;
- excluded from sitemap;
- marked `noindex`.

Exact resting-state copy requires content approval.

---

## 26. Empty and error content states

Required state categories:

- 404;
- archived;
- no search results;
- no Saved Paths;
- no Recently Visited;
- Greenhouse unavailable;
- save failed;
- upload failed;
- unauthorized.

New copy must:

- remain concise;
- state what happened;
- provide a next action;
- preserve The Garden tone;
- avoid hiding meaning behind metaphor.

Example wording discussed during planning is not automatically approved visitor-facing copy.

---

## 27. Content safety and truthfulness

Garden Keeper and migration scripts must not invent:

- personal biography;
- achievements;
- course results;
- scores;
- research outcomes;
- trauma;
- diagnoses;
- medical information;
- private relationships;
- contact information;
- project claims;
- dates not present in source content.

Missing content must remain:

- blank;
- Draft;
- hidden;
- or explicitly marked for later completion.

AI-generated text is never treated as confirmed personal content until reviewed and edited by the Garden Keeper.
