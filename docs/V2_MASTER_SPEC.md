# The Garden — Version 2 Master Specification

## 1. Document purpose

This document is the product and technical source of truth for **The Garden Version 2**.

Version 2 is an upgrade of the existing, stable Version 1 website. It is not a rebuild from zero.

When documents or implementation details conflict, use the following priority:

1. `docs/V2_MASTER_SPEC.md`
2. `docs/V2_CONTENT.md`
3. `docs/V2_MIGRATION.md`
4. Verified stable implementation and automated tests
5. `docs/V2_TODO.md`
6. Version 1 documents as historical reference

Version 1 documents must remain available and must not be overwritten by Version 2 documents.

---

## 2. Project definition

The Garden is a personal digital garden for recording:

- ongoing learning;
- unresolved questions;
- reflections and interests;
- unfinished or discontinued attempts;
- ideas cultivated with AI.

It is not:

- a résumé;
- a traditional portfolio;
- a chronological blog;
- a social community;
- a generic content-management dashboard.

Version 2 changes The Garden from a mostly static published site into a garden that can be continuously tended without editing source code for every content update.

### Version 2 core statement

> The Garden V2 adds the ability to plant, tend, review, publish, archive, and trace content while preserving the world, routes, reading experience, and accessibility standards established in Version 1.

---

## 3. Version 1 baseline

Version 2 begins from the deployed Version 1 implementation.

### Technical baseline

- Next.js `15.5.9`
- React `19.1.1`
- TypeScript
- App Router
- DeepSeek API
- model: `deepseek-v4-flash`
- environment variable: `DEEPSEEK_API_KEY`
- GitHub repository: `moonsoul608/the-garden`
- Vercel deployment
- EdgeOne deployment work exists but public-domain handling is outside the core V2 product scope

### Existing public structure

Main routes:

- `/`
- `/garden`
- `/forest`
- `/lake`
- `/ruins`
- `/greenhouse`
- `/index`
- `/search`

Dynamic detail routes:

- `/garden/[slug]`
- `/forest/[slug]`
- `/lake/[slug]`
- `/ruins/[slug]`

API:

- `POST /api/seed-gardener`

Version 1 contains 19 initial content items:

- 5 Garden Seeds
- 5 Forest Questions
- 5 Lake Reflections
- 4 Ruins Traces

Version 1 already includes:

- desktop and mobile layouts;
- Garden Guide navigation;
- Garden Index;
- Search;
- Greenhouse AI;
- keyboard support;
- visible focus states;
- reduced-motion handling;
- accessibility review;
- lint, TypeScript, build, and test checks.

The 19 items are the **V1 Initial Garden**, not a permanent content limit.

---

## 4. Protected core

The following must be preserved unless a later approved specification explicitly changes them.

### 4.1 World and Regions

Keep the six Regions:

- Home
- Garden
- Forest
- Lake
- Ruins
- Greenhouse

Do not add a new Region in Version 2.

### 4.2 Meaning of each Region

- **Home**: entrance, orientation, and curated paths.
- **Garden**: learning, making, and content actively growing.
- **Forest**: unresolved questions and exploratory thought.
- **Lake**: reflection, resonance, and things worth keeping.
- **Ruins**: drafts, mistakes, abandoned attempts, and traces.
- **Greenhouse**: AI-assisted cultivation of incomplete ideas.

### 4.3 Existing routes

Do not break existing main routes, detail routes, `/index`, `/search`, or `/api/seed-gardener`.

Existing slugs and public URLs must remain stable through migration.

### 4.4 Reading and navigation

Do not sacrifice:

- content clarity;
- reading comfort;
- direct navigation;
- mobile usability;
- keyboard operation;
- visible focus;
- semantic headings;
- reduced motion;
- accessible status communication.

### 4.5 Product tone

Do not replace established garden language with generic labels such as:

- Projects
- Blog
- Posts
- Categories
- Dashboard

The admin interface may use clear operational language, but it should remain recognizably part of The Garden.

---

## 5. Version 2 goals

Version 2 must solve the following Version 1 limitations.

### 5.1 Content updates require coding

V2 must allow the Garden Keeper to create and update content from a protected admin interface without editing TypeScript data files for routine changes.

### 5.2 Home content is duplicated and manually embedded

`Currently Growing` and `Recently Planted` must keep separate meanings while reading from the same canonical content source.

### 5.3 Content growth is mostly visual or descriptive

V2 must introduce:

- lifecycle state;
- growth stage;
- growth notes;
- a public, concise Growth Timeline.

### 5.4 Content connections require code changes

V2 must allow the Garden Keeper to maintain a small number of explicit content relationships from the admin interface.

### 5.5 Garden Index and Search overlap

V2 must merge their public experience into `/index`.

`/search` must remain compatible and lead to the merged experience while preserving search query parameters.

### 5.6 Visitors can lose their path

V2 must add a lightweight Path Back Navigation pattern that reflects the visitor's entry source when possible.

### 5.7 Greenhouse output is disconnected from content maintenance

V2 must allow a Greenhouse result to become a private Draft for Garden Keeper review. AI must never publish content automatically.

### 5.8 Version 1 documentation is behind the implementation

V2 documentation must describe the actual migration baseline and must remain separate from Version 1 documentation.

---

## 6. Scope classification

### 6.1 Preserve

- all six Regions;
- the eight existing main routes;
- the existing four dynamic detail-route families;
- the Greenhouse server API;
- the current visual world;
- desktop map and mobile path-list strategies;
- current accessibility baseline;
- static Version 1 content as a temporary migration fallback;
- manual editorial judgment.

### 6.2 Optimize

- Home curation and content sourcing;
- Garden Index and Search;
- detail-page reading hierarchy;
- Path Back Navigation;
- mobile information order;
- bilingual content handling;
- SEO metadata and sharing previews;
- error, empty, and archived states;
- regional card and filter affordances;
- documentation and migration governance.

### 6.3 Add

- Supabase database and Storage;
- Garden Keeper admin;
- GitHub OAuth;
- content lifecycle;
- Markdown editor with enhanced controls;
- cover-image management;
- growth notes and public Growth Timeline;
- manual content relations;
- draft preview;
- local saved paths;
- local recently visited paths;
- lightweight sharing;
- private visitor notes;
- anonymous aggregate analytics;
- Markdown import;
- JSON and Markdown export;
- Preview/Staging environment.

### 6.4 Remove or merge

- merge the public Search experience into Garden Index;
- keep `/search` as a compatibility route;
- remove duplicate public navigation entries after the merge;
- do not remove any Region or existing detail route during migration.

---

## 7. Technical architecture

Version 2 remains a single Next.js application.

### 7.1 Required stack

Keep:

- Next.js 15.5.9 unless a separately approved dependency-upgrade task changes it;
- React 19;
- TypeScript;
- App Router;
- Vercel;
- DeepSeek.

Add:

- Supabase PostgreSQL;
- Supabase Storage;
- Supabase Auth with GitHub provider.

### 7.2 No separate backend

Do not introduce:

- a separate Node service;
- NestJS;
- FastAPI;
- GraphQL;
- microservices.

Use:

- Server Components;
- Server Actions where appropriate;
- Route Handlers where public or external HTTP boundaries are required;
- a shared service layer for database access and validation.

### 7.3 Data-flow rule

Public pages and admin pages must not contain duplicated database logic.

Use a shared structure equivalent to:

```text
Page / Server Action / Route Handler
                ↓
          Domain service
                ↓
        Validation and auth
                ↓
             Supabase
```

### 7.4 Environment separation

Use separate data environments:

- Vercel Preview/Staging → separate Supabase Preview project
- Vercel Production → Supabase Production project

Preview operations must never modify production content or production Storage.

---

## 8. Public routes

### 8.1 Existing routes

Keep all Version 1 public routes.

### 8.2 Merged Index and Search

`/index` becomes the canonical public discovery page containing:

- keyword search;
- Region filters;
- Content Type filters;
- Growth Stage filters;
- lightweight date-oriented filters;
- Saved Paths;
- Recently Visited.

`/search` must remain valid and redirect or rewrite to `/index`.

Requirements:

- preserve `q` and supported filter query parameters;
- focus the search input when arriving through `/search`;
- do not create a second search implementation.

### 8.3 Admin routes

Add a protected admin area beginning at:

- `/admin`

The exact internal admin subroutes may be implementation-defined, but they must remain inaccessible to non-admin users.

### 8.4 Preview route

Add a secure preview route for Draft or Review content.

Requirements:

- random, revocable token;
- no edit permission;
- no indexing;
- no sitemap entry;
- clear Preview Mode indicator;
- token can be disabled or regenerated.

### 8.5 Archived routes

An archived item keeps its public URL but is removed from:

- Region collections;
- Garden Index;
- Search;
- Home curation;
- sitemap.

Direct access shows a dedicated resting-state page rather than the full published body.

### 8.6 Deleted routes

Permanent deletion is only available after archive.

After deletion:

- remove public content;
- remove associated versions and relations according to the deletion workflow;
- remove unused Storage objects;
- return a designed 404 or Gone response;
- never silently reuse the same route for a different item.

---

## 9. Stable URL policy

Public content uses the existing pattern:

```text
/garden/[slug]
/forest/[slug]
/lake/[slug]
/ruins/[slug]
```

Rules:

- slug is suggested at creation time;
- slug must be unique within its Region;
- after first publication, slug is stable by default;
- title changes must not change the URL;
- Region changes require an explicit migration record and redirect;
- old URLs must not break silently;
- a deleted slug must not be automatically reassigned.

---

## 10. Content model principles

Version 2 extends the Version 1 model instead of replacing it with a block-based CMS model.

Keep the main concepts:

- Region
- Content Type
- Growth Stage
- Detail Level
- category
- tags
- slug
- summary
- body

Add:

- lifecycle;
- bilingual fields;
- publication dates;
- last tended time;
- cover image;
- growth notes;
- relations;
- versions;
- Home curation;
- featured state.

The detailed field contract is defined in `docs/V2_CONTENT.md`.

---

## 11. Content lifecycle

Lifecycle and Growth Stage are separate dimensions.

### 11.1 Lifecycle

Allowed lifecycle values:

- `Draft`
- `Review`
- `Published`
- `Archived`

`Deleted` is a terminal action, not a normal editable lifecycle value.

### 11.2 Workflow

All new content uses:

```text
Draft → Review → Published → Archived → Delete permanently
```

Rules:

- all creation sources begin as Draft;
- Draft and Review content are admin-only;
- Review is required before first publication;
- Published content appears publicly;
- Archived content is hidden from discovery but retains a resting-state URL;
- permanent deletion is available only from Archived;
- permanent deletion requires a second confirmation and an impact summary.

### 11.3 Creation sources

A Draft may come from:

- direct Garden Keeper creation;
- Greenhouse result explicitly saved as Draft;
- Markdown single-file import.

No source may bypass Review.

---

## 12. Growth system

Allowed Growth Stages:

- `Seed`
- `Sprout`
- `Growing`
- `Bloom`
- `Dormant`

Rules:

- Growth Stage is manually assigned;
- it must never be inferred automatically from age, views, or word count;
- changing Growth Stage requires a Growth Note;
- Growth Notes may be private or public;
- selected public Growth Notes form the concise Growth Timeline;
- ordinary text edits do not automatically create Growth Notes;
- Growth Stage and lifecycle must not be conflated.

Example:

```text
Lifecycle: Published
Growth Stage: Seed
```

This means the item is publicly visible but still represents an early idea.

---

## 13. Garden Keeper admin

### 13.1 Positioning

The admin is called **Garden Keeper**.

It uses a professional management layout with restrained Garden language.

It must prioritize:

- speed;
- clarity;
- reliable editing;
- safe destructive actions;
- keyboard accessibility.

It must not become a decorative imitation of the public site.

### 13.2 Authentication

Use GitHub OAuth.

Only the account associated with `moonsoul608` may access Garden Keeper.

Implementation should bind access to the verified GitHub provider identity, preferably the immutable provider account ID, with the username retained as a readable allow-list check.

### 13.3 Admin capabilities

Garden Keeper must support:

- content list;
- content search and filters;
- create;
- edit;
- autosave Draft;
- move to Review;
- publish;
- unpublish to Draft or Review according to the final implementation;
- archive;
- restore archived content;
- permanently delete archived content;
- mark Featured;
- manage Home curation;
- manage Growth Stage and Growth Notes;
- manage relations;
- upload, replace, and remove one cover image;
- edit optional bilingual fields;
- view and restore recent versions;
- generate and revoke preview links;
- view visitor notes;
- view anonymous analytics;
- edit approved site copy;
- edit approved Greenhouse prompt configuration;
- import one Markdown file;
- export content.

### 13.4 No batch operations

Version 2 must not add bulk editing, bulk publishing, or bulk deletion.

### 13.5 Mobile admin

Admin must remain usable on mobile for:

- viewing;
- note moderation;
- analytics;
- small edits;
- status changes.

Long-form Markdown editing may be optimized primarily for desktop.

---

## 14. Markdown editor

Use Markdown as the canonical body format.

### 14.1 Editor behavior

Desktop:

- Markdown editing pane;
- live preview pane;
- full-page secure preview.

Mobile:

- switchable Edit and Preview modes rather than a cramped forced split view.

### 14.2 Enhanced controls

Provide simple helpers for:

- heading;
- bold;
- italic;
- quote;
- list;
- link.

Do not create:

- a Notion-style block editor;
- drag-and-drop page building;
- arbitrary HTML editing;
- custom layout components.

### 14.3 Cover image

Each content item may have at most one cover image.

Requirements:

- optional;
- upload, replace, remove;
- stored in Supabase Storage;
- alt text required before publication when an image exists;
- format and file-size validation;
- no general media library in V2;
- no arbitrary inline image-upload system in V2.

---

## 15. Autosave and versions

### 15.1 Autosave

Draft editing must support autosave.

Show clear states:

- Saving…
- Saved
- Save failed

Rules:

- autosave never publishes;
- autosave never creates a version snapshot;
- warn before navigation when unsaved local changes remain.

### 15.2 Version history

Keep the most recent 10 meaningful versions per item.

Create a version when:

- the Garden Keeper explicitly saves a version checkpoint;
- content is published;
- content is restored from an older version.

Do not create a version for every autosave.

Restoring a version must first preserve the current content as a new version.

---

## 16. Categories, tags, and relations

### 16.1 Fixed primary taxonomy

Keep the Version 1 primary structures fixed.

Garden Beds:

- Psychology
- AI
- Coding
- Design & Making

Forest Trails, Lake Ripples, and Ruins Trace Types remain the Version 1 confirmed values.

Do not allow Garden Keeper to create new Regions or new primary taxonomy groups in V2.

### 16.2 Free tags

Garden Keeper may add free tags.

Tags:

- support discovery and search;
- do not change Region;
- do not create new primary navigation;
- do not require a complex tag-administration system in V2.

### 16.3 Manual relations

Support the following relation types:

- `grewFrom`
- `grewInto`
- `relatedTo`

Rules:

- target must be an existing content item;
- relationships are selected manually;
- no AI relation generation;
- no automatic recommendation;
- no graph editor;
- no arbitrary external URL in a content relation;
- keep the public relation display concise.

---

## 17. Home curation

Home remains manually curated.

### 17.1 Currently Growing

Purpose:

- content actively being tended;
- typically Sprout or Growing;
- 3–4 items.

### 17.2 Recently Planted

Purpose:

- newly published content;
- maximum 2 items.

### 17.3 Rules

- the same item must not appear in both sections at the same time;
- the system may suggest candidates;
- the Garden Keeper confirms inclusion and order;
- Home must not become an automatic latest-post feed;
- Home content must reference canonical content records instead of duplicating titles, summaries, statuses, or URLs.

---

## 18. Region ordering and Featured content

Default Region ordering:

1. Featured content
2. configured manual order within the relevant group when present
3. Growth Stage priority
4. `lastTendedAt` descending

Featured rules:

- manually controlled;
- not based on views;
- not AI-selected;
- maximum 3 Featured items per Region;
- Home curation remains independent from Featured.

Garden Index defaults to recently tended unless a visitor selects another supported sort.

Search results prioritize query relevance rather than Growth Stage.

---

## 19. Garden Index and enhanced search

The merged `/index` experience supports:

- Chinese title and summary;
- English title and summary;
- tags;
- primary categories;
- Region;
- Content Type;
- Growth Stage;
- recently planted;
- recently tended.

Do not add AI semantic search or vector search in V2.

Do not require full-body search in V2.

Only Published content appears in public results.

Saved Paths and Recently Visited are displayed as local visitor tools within Garden Index and may be linked from Garden Guide.

---

## 20. Bilingual strategy

Version 2 uses systematic bilingual fields without adding a language-switching system.

### 20.1 Fixed world language

The following remain primarily English:

- Region names;
- Growth Stage names;
- established atmospheric phrases;
- established navigation language where already confirmed.

### 20.2 Content language

A content item may provide:

- Chinese only;
- English only;
- both;
- intentionally mixed content.

Garden Keeper must allow selection and editing of Chinese and English fields.

No content is required to provide a complete translation.

### 20.3 Search and metadata

Search must match both language variants when present.

Metadata chooses the best available title and summary for the item.

---

## 21. Greenhouse V2

Keep the current DeepSeek server-side integration and structured-output validation.

### 21.1 Public behavior

Public visitors may:

- submit an idea;
- receive a structured Seed result;
- copy or share the result according to the approved interface.

A public request must not silently publish content.

### 21.2 Draft handoff

An explicit, authorized save action may create a Garden Keeper Draft from a Greenhouse result.

Rules:

- Draft only;
- never auto-publish;
- Garden Keeper reviews title, Region, Content Type, Growth Stage, tags, body, and relations;
- AI suggestions are editable;
- AI does not make final editorial decisions.

### 21.3 Admin-configurable AI fields

Garden Keeper may edit:

- system prompt;
- output style guidance;
- example inputs and outputs;
- approved recommendation rules.

Garden Keeper must not edit:

- API key;
- provider URL;
- model name;
- timeout;
- security controls;
- schema-validation code;
- error-handling code.

---

## 22. Visitor features

### 22.1 Leave a note

Implement a simple private note form.

Visitor fields:

- message: required;
- name: optional.

Admin capabilities:

- list;
- read;
- mark read/unread;
- delete.

Rules:

- notes are private by default;
- no public comment thread;
- no replies;
- no likes;
- no visitor accounts.

Use rate limiting and spam protection appropriate to the project scale.

### 22.2 Saved Paths

Use local browser storage only.

Behavior:

- unselected: outlined star;
- selected: filled yellow star;
- do not rely on color alone;
- use `aria-pressed`;
- keyboard accessible;
- show clear save/remove feedback;
- disclose that saves remain on the current device only.

Saved Paths must not create accounts, server records, popularity counts, or cross-device sync.

### 22.3 Recently Visited

Store the most recent 5–10 content items locally.

Rules:

- local device only;
- manually clearable;
- remove or hide unavailable items;
- do not place as a new Home section;
- surface in Garden Index and optionally through Garden Guide.

### 22.4 Sharing

Detail pages support:

- Web Share API when available;
- copy-link fallback;
- clear completion feedback.

Do not add social counts or identity tracking.

### 22.5 No global random entry

Keep existing Region-specific random interactions.

Do not add a site-wide random-content button.

---

## 23. Navigation and path recovery

### 23.1 Path Back Navigation

Detail pages must provide a visible back-path control near the top.

Priority:

1. return to the actual internal source when reliable;
2. otherwise return to the owning Region;
3. never create a dead back action.

Examples:

- Back to Garden
- Back to Forest
- Back to Garden Index

### 23.2 Lightweight path context

Use only a small amount of breadcrumb-like context.

Do not add:

- a full site breadcrumb bar;
- a left navigation tree;
- a persistent path-history graph.

### 23.3 Accessibility

The control must be:

- keyboard accessible;
- clearly labeled;
- visible on mobile;
- independent of browser-history availability.

---

## 24. Public Growth Timeline

Published detail pages may show a concise Growth Timeline.

Each public entry contains:

- Growth Stage;
- date;
- one short note.

Rules:

- only Growth Notes marked public are shown;
- private notes and version history remain admin-only;
- ordinary text edits do not create timeline entries;
- timeline must not overwhelm the main content.

---

## 25. Visual and mobile upgrade

Version 2 uses local visual improvement, not a complete redesign.

### 25.1 Preserve

- existing regional moods;
- garden metaphor;
- restrained motion;
- readable cards;
- desktop Home map;
- mobile path list.

### 25.2 Improve

- optional cover-image integration;
- card hierarchy;
- detail-page hierarchy;
- Growth Stage display;
- Growth Timeline;
- relation display;
- Path Back Navigation;
- Home status hints;
- mobile Garden Index;
- mobile Greenhouse;
- mobile detail reading order.

### 25.3 Do not add

- 3D garden;
- continuous particle systems;
- background video;
- heavy parallax;
- mouse-following;
- motion required for understanding.

All motion must continue to support `prefers-reduced-motion`.

---

## 26. Empty, error, archived, and 404 states

Design states within The Garden world while keeping instructions clear.

Required states:

- 404;
- archived/resting content;
- no search results;
- no Saved Paths;
- no Recently Visited items;
- Greenhouse failure;
- save failure;
- upload failure;
- unauthorized admin access.

Rules:

- concise;
- useful next action;
- no obscure metaphor that hides the problem;
- no raw provider, database, or stack error exposed to visitors.

Exact new visitor-facing copy must be approved in `docs/V2_CONTENT.md` or later content review.

---

## 27. Analytics and privacy

Add lightweight anonymous aggregate analytics for:

- public page views;
- Region views;
- content views;
- Greenhouse use count;
- note submissions;
- share-button use.

Do not persist:

- visitor identity;
- account data;
- user profiles;
- cross-site identifiers;
- full browsing trails;
- IP addresses in the application database.

The application may process request metadata transiently as required by hosting infrastructure, but it must not deliberately store identifying request data for analytics.

Analytics are visible only in Garden Keeper.

Do not add advertising analytics, heatmaps, or commercial tracking.

---

## 28. Import and export

### 28.1 Markdown import

Support one Markdown file per import.

Imported content:

- becomes Draft;
- never auto-publishes;
- may use a documented frontmatter subset;
- must pass validation;
- requires Review.

Do not add folder sync, Obsidian vault sync, or bulk import in V2.

### 28.2 Export

Support:

- JSON export;
- Markdown export.

Allow export selection for:

- Published only;
- include Drafts;
- include Archived.

Exports must preserve the user's ownership of content.

Do not automatically commit exported content to GitHub.

---

## 29. Site copy settings

Garden Keeper may edit approved fixed copy, including selected:

- Home introduction;
- About text;
- Region descriptions;
- ending copy;
- Footer explanatory text;
- selected CTA labels.

Garden Keeper may not edit:

- Region count;
- Region names;
- route structure;
- page section order;
- map structure;
- component layout;
- security messages that require code-controlled wording.

The exact editable keys are defined in `docs/V2_CONTENT.md`.

---

## 30. SEO and sharing previews

Add basic content-level SEO.

Required:

- dynamic page title;
- dynamic description;
- Open Graph metadata;
- content-level share preview;
- cover-image use when available;
- fallback share image when not available;
- sitemap for public Published routes.

Exclude:

- Draft;
- Review;
- Archived;
- admin;
- preview routes.

Archived and preview pages must be `noindex`.

Do not add:

- AI SEO writing;
- keyword-ranking tools;
- marketing dashboards;
- advertising scripts.

---

## 31. Security model

### 31.1 Roles

Only two effective roles exist:

- Visitor
- Garden Keeper

No multi-role RBAC is required.

### 31.2 Public access

Visitors may:

- read Published content;
- use public search and filters;
- use Greenhouse;
- submit a private note;
- use local Saved Paths and Recently Visited;
- share links.

Visitors may not:

- read Draft or Review content without a valid preview token;
- read admin notes or analytics;
- write or alter content;
- alter AI configuration;
- upload media.

### 31.3 Write access

All content, settings, media, moderation, and analytics-management writes must pass:

1. authenticated GitHub session;
2. verified Garden Keeper allow-list check;
3. server-side validation;
4. authorized Supabase operation.

Do not trust client-side admin state.

### 31.4 Database policy

Use Row Level Security or an equivalent server-controlled policy so that:

- public access is limited to approved public data;
- Draft and Review data are not publicly queryable;
- visitor note submission cannot read other notes;
- only Garden Keeper can perform administrative writes;
- Storage upload and delete are admin-only.

Service-role credentials must never be exposed to the client.

---

## 32. Testing and acceptance

Keep the Version 1 baseline:

- lint;
- TypeScript check;
- production build;
- existing tests.

Add focused tests for:

- public content filtering;
- Draft and Review privacy;
- archived discovery removal;
- authentication and admin authorization;
- migration count and URL preservation;
- Garden Index/Search merge;
- content creation and publishing;
- autosave failure handling;
- version creation and restore;
- cover-image validation;
- Greenhouse Draft handoff;
- visitor note submission and admin moderation;
- local Saved Paths behavior;
- Path Back Navigation fallback;
- sitemap exclusions;
- accessibility and reduced motion.

Do not require enterprise-scale load testing or exhaustive end-to-end coverage.

Manual QA remains required for:

- page rhythm;
- regional mood;
- mobile reading;
- keyboard navigation;
- visual focus;
- reduced motion;
- copy accuracy;
- Garden-world consistency.

---

## 33. Version 2 non-goals

Version 2 must not include:

- a new Region;
- public user accounts;
- cross-device saved items;
- public comments;
- replies;
- likes;
- community feeds;
- multiple admin roles;
- team collaboration;
- page builder;
- block-based CMS;
- database-driven arbitrary layouts;
- AI automatic publishing;
- AI automatic relation generation;
- AI automatic classification as final authority;
- AI semantic search;
- vector database;
- model selector;
- editable API keys in admin;
- native mobile app;
- PWA;
- push notifications;
- email notification system;
- a site-wide random-content button;
- dynamic knowledge graph;
- 3D garden;
- complex full-page animation;
- separate backend service;
- GraphQL;
- microservices;
- bulk content operations;
- general media library;
- arbitrary inline image uploads;
- content cloning or branching system;
- merge workflow.

---

## 34. Version 2 completion definition

Version 2 is complete when:

- the public V1 experience remains accessible;
- all V1 public URLs remain valid or intentionally redirected;
- the 19 V1 items are represented correctly in the new data layer;
- Garden Keeper authentication is secure;
- Garden Keeper can create, review, publish, archive, restore, and delete content according to the lifecycle;
- routine content updates no longer require code changes or redeployment;
- Markdown editing, preview, autosave, and version restore work;
- cover-image handling works;
- Growth Stage and Growth Notes work;
- public Growth Timeline works;
- manual relations work;
- Home curation uses canonical content;
- Garden Index and Search are merged;
- `/search` remains compatible;
- Path Back Navigation works;
- Greenhouse can hand off an explicitly saved result as Draft;
- Leave a note works privately;
- Saved Paths and Recently Visited work locally;
- sharing works;
- anonymous analytics are available to Garden Keeper;
- SEO metadata, Open Graph, and sitemap behavior are correct;
- Preview and Production data remain isolated;
- lint, typecheck, build, tests, accessibility, mobile, and reduced-motion checks pass;
- no unapproved personal content has been invented.
