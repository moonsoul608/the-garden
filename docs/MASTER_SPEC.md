# The Garden — Version 1 Master Specification

## 1. Project definition

The Garden is a personal digital garden for recording learning, questions, interests, discontinued attempts, and ideas developed with AI.

It is not a traditional résumé, portfolio, or blog.

Core experience:

> Visitors should understand the site quickly while still feeling: “I want to click once more and see what happens.”

Course goals:

- practical usefulness;
- a consistent and memorable visual design;
- a working online AI feature;
- stable desktop and mobile experiences.

## 2. Technical baseline

Recommended stack:

- Next.js
- TypeScript
- Tailwind CSS or CSS Modules
- server-side AI route
- Vercel deployment

Version 1 content storage:

- TypeScript data files or JSON for metadata;
- MDX or structured TypeScript content for long detail pages;
- no database.

AI security:

- AI calls must run server-side;
- API keys must remain in environment variables;
- raw provider errors must not be shown to users.

Provider decision:

- Phase 4 uses DeepSeek `POST https://api.deepseek.com/chat/completions` with `deepseek-v4-flash`, thinking disabled, and the server-only `DEEPSEEK_API_KEY` environment variable;
- Phases 1–3 must not install an AI SDK, create a real API key, select a model, or simulate a real AI success response;
- shared AI types and interfaces must remain provider-neutral until Phase 4.

## 3. Routes

```text
/
├── /garden
├── /garden/[slug]
├── /forest
├── /forest/[slug]
├── /lake
├── /lake/[slug]
├── /ruins
├── /ruins/[slug]
├── /greenhouse
├── /index
├── /search
└── /api/seed-gardener
```

## 4. Global navigation

Top bar contains only:

- `The Garden` mark, linking to `/`;
- Search icon, linking to `/search`;
- Garden Guide button.

Garden Guide contains:

### Regions

- Home
- Garden
- Forest
- Lake
- Ruins
- Greenhouse

### Utilities

- Garden Index
- Search the Garden
- Back to the entrance

The current page must show `You are here.` using text or icon as well as colour.

Desktop: right-side drawer.  
Mobile: full-screen or bottom-sheet panel.

## 5. Footer

Visible content:

```text
The Garden

Tended by Xianhong.

Garden Guide · Garden Index · Search the Garden · Leave a note

```

Do not invent contact information. If unavailable, show:

`This path is still being prepared.`

Version 1 does not show `Last tended` until reliable dates exist. `Leave a note` must not behave like a working external link while contact information is unavailable.

## 6. Shared content types

```ts
type RegionName = "Garden" | "Forest" | "Lake" | "Ruins";

type ContentType = "Seed" | "Question" | "Reflection" | "Trace";

type GrowthStatus =
  | "Seed"
  | "Sprout"
  | "Growing"
  | "Bloom"
  | "Dormant";

type DetailLevel = "full" | "short";

type ContentItem = {
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
```

Data normalization rules:

- `id` must equal `slug`; never generate random IDs;
- Garden items use `region: "Garden"`, `contentType: "Seed"`, and `categories: beds`;
- Forest items use `region: "Forest"`, `contentType: "Question"`, and `categories: trails`;
- Lake items use `reflectionType` rather than `type`, plus `region: "Lake"`, `contentType: "Reflection"`, `categories: [reflectionType]`, and `summary: reason`;
- Ruins items use `region: "Ruins"`, `contentType: "Trace"`, and `categories: [traceType]`;
- Version 1 does not invent tags; omit the optional field or use `tags: []`;
- unconfirmed images use `image: undefined` and must not render an empty image frame.

Region-specific fields:

```ts
type GardenItem = ContentItem & { beds: string[] };
type ForestItem = ContentItem & { trails: string[] };
type LakeItem = ContentItem & {
  reflectionType: string;
  reason: string;
};
type RuinsItem = ContentItem & {
  traceType: string;
  grewInto?: string;
};
```

## 7. Shared status system

- 🌰 Seed
- 🌱 Sprout
- 🌿 Growing
- 🌸 Bloom
- 🍂 Dormant

Always display icon and text together. Status is set manually. Greenhouse may generate only Seed or Sprout.

## 8. Detail levels

Every card must lead to a valid route.

`detailLevel: "full"` uses the complete Region template.

`detailLevel: "short"` displays:

- title;
- summary;
- Region or type;
- status or category;
- a short explanation;
- related paths;
- one Region-specific unfinished message.

Messages:

- Garden: `This seed is still being tended.`
- Forest: `This thought is still growing.`
- Lake: `This reflection has not been fully written yet.`
- Ruins: `Only part of this trace remains.`

No valid card may lead to a blank page or 404.

Confirmed detail-content requirements:

- `Learning Psychological Statistics` uses the complete confirmed sections in `docs/CONTENT.md`: Why it was planted, What has grown so far, Growth notes, and Where this path leads next;
- `人为什么会害怕遗忘？` uses the complete confirmed sections in `docs/CONTENT.md`: Why I started thinking about it, What I think so far, and Where it may lead;
- the statistics detail must not add grades, scores, exam results, teacher evaluations, course details, or research findings;
- the forgetting detail must not add personal trauma, psychological diagnoses, medical experiences, or health information;
- short-detail explanations and related paths must use only the confirmed entries in `docs/CONTENT.md`;
- `An unfinished version of “继续吗”` uses the confirmed explanation and related paths in `docs/CONTENT.md`;
- it links only to `/forest/why-people-fear-forgetting` and `/ruins`, and does not create a novel detail page or an additional Forest item.

## 9. Home

Route: `/`

Internal components:

```text
OpeningSection
WelcomeSection
AboutGardenerSection
CurrentlyGrowingSection
GardenMapSection
RecentlyPlantedSection
RandomCompassSection
Footer
```

Internal names must not be rendered.

Visitor-visible sequence:

```text
Take your time.
There is no right path.
Plant the seed.
↓
Welcome to The Garden.
↓
About the gardener
↓
Currently Growing
↓
Paths from here
↓
Recently Planted
↓
Where next?
↓
Footer
```

### Home requirements

- Opening is skippable and supports reduced motion.
- Home map is a branching map on desktop.
- On mobile, the map becomes a vertical path list.
- Where next? exists only on Home.
- Recently Planted contains only:
  - The Garden
  - 继续吗
- Currently Growing contains:
  - Building The Garden
  - Learning Psychological Statistics
  - Exploring AI Tools
  - Continuing “继续吗”

Home route decisions:

- `Exploring AI Tools` belongs to Garden, shows `🌱 Sprout · Garden`, uses `Follow this seed →`, and links to `/garden/exploring-ai-tools`;
- `Continuing “继续吗”` and the Recently Planted item `继续吗` both use `Follow the memory →` and link to `/forest/why-people-fear-forgetting`;
- Version 1 does not add a separate “继续吗” detail route or a sixth Forest Question;
- Home → Recently Planted → `The Garden` links to `/garden/building-the-garden`;
- the Lake Reflection `The Garden` remains `/lake/the-garden`.

## 10. Garden

Route: `/garden`

Visible structure:

```text
Garden
Where learning takes root.
↓
Growing Beds
↓
Choose what is growing
↓
What is growing here
↓
Growth is rarely a straight line.
```

Growing Beds:

- Psychology
- AI
- Coding
- Design & Making

Required functions:

- Bed filtering;
- Garden-specific search;
- stable source-data ordering while reliable dates are unavailable;
- five Seed cards;
- full and short detail routes.

Seed list:

1. Building The Garden — full
2. Learning Psychological Statistics — full
3. Exploring AI Tools — short
4. Python: Starting from the Basics — short
5. Designing Better Slides and Documents — short

Do not build:

- status filtering;
- sorting controls;
- advanced tags;
- comments;
- collections;
- editor dashboard.

## 11. Forest

Route: `/forest`

Visible structure:

```text
Forest
Where questions grow wild.
↓
Trails of Thought
↓
Questions growing here
↓
A question found you
↓
Some paths end in answers. Others become better questions.
```

Trails:

- Mind & Behavior
- Humans & AI
- Design & Experience
- Stories & Memory

Question list:

1. 为什么探索式网站会让人更愿意继续点击？ — full
2. AI 可以帮助人思考，还是只是在替人组织答案？ — short
3. 人为什么会害怕遗忘？ — full
4. 心理学如何影响产品和网页设计？ — short
5. 一个问题什么时候应该从 Forest 移到 Garden？ — short

Required functions:

- Trail filtering;
- random Question interaction;
- Question detail routes;
- `Grow it in the Greenhouse`;
- prefill Greenhouse with the selected Question.

Do not build:

- automatic question generation;
- submissions;
- likes;
- comments;
- reading-time metadata.

## 12. Lake

Route: `/lake`

Visible structure:

```text
Lake
Things worth reflecting on.
↓
Ripples
↓
Reflections on the water
↓
Something surfaced
↓
The lake keeps what once mattered.
```

Ripple filters must be lightweight pills:

- All
- Music
- Games
- Films
- Books & Words
- Internet

Reflection list:

1. Reverse: 1999 — full
2. 荣格与曼陀罗 — short
3. The Garden — short
4. 《爱爱爱》— 方大同 — full
5. 《夏日幽灵》 — full

Required functions:

- Ripple filtering;
- Something surfaced random Reflection;
- full and short detail routes.

Do not build:

- media playback;
- ratings;
- rankings;
- comments;
- external account syncing;
- complex water simulation.

## 13. Ruins

Route: `/ruins`

Visible structure:

```text
Ruins
Ruins are not failures. They are traces.
↓
Types of traces
↓
What remains here
↓
Nothing disappears without leaving something behind.
```

Trace types:

- Drafts
- Attempts
- Mistakes

These are explanatory cards only. Do not implement filtering.

Trace list:

1. The first version of Home — full
2. A portfolio that was never built — short
3. Too much interaction — short
4. An unfinished version of “继续吗” — short

Required interaction:

- `See what grew from it` links to a related current Seed or Question.

Do not build:

- random Trace;
- Ruins filters;
- version comparison;
- restoration tools;
- complex decay animation.

## 14. Greenhouse

Route: `/greenhouse`

Visible structure:

```text
Greenhouse
Give an idea somewhere to grow.
↓
Plant an idea
↓
Your Seed
↓
Try a sample seed
↓
Every idea needs a first step.
```

Required input:

- a question;
- an interest;
- a vague idea;
- a prefilled Forest Question.

Required output:

```ts
type SeedResult = {
  seedName: string;
  coreQuestion: string;
  suggestedRegion: "Garden" | "Forest";
  growthStage: "Seed" | "Sprout";
  pathsToExplore: [string, string, string];
  firstStep: string;
};
```

Rules:

- use the same language as the input;
- exactly three exploration paths;
- firstStep must be actionable today;
- do not return a long final answer;
- do not recommend Home, Lake, Ruins, or Greenhouse;
- do not return Growing, Bloom, or Dormant.

Required actions:

- Copy this Seed
- Grow it again
- Edit the idea
- Plant another idea

Required states:

- empty;
- loading;
- success;
- error;
- Forest prefill.

API route:

`POST /api/seed-gardener`

AI endpoint must be server-side.

## 15. Garden Index

Route: `/index`

Visible title: `Garden Index`

Tagline: `Everything kept across the garden.`

Include:

- Seed
- Question
- Reflection
- Trace

Filters:

- Region
- Content Type

Search:

- title;
- summary;
- categories;
- tags.

Default ordering uses the stable merged Region source order while reliable dates are unavailable. Do not show a sorting control or claim that the order represents real recent updates.

Do not use `All Seeds` as a visible label.

## 16. Search the Garden

Route: `/search`

Visible title: `Search the Garden`

Tagline: `Look for a word. Find a path.`

Search:

- title;
- summary;
- categories;
- tags.

Search field mapping:

- Garden categories = beds;
- Forest categories = trails;
- Lake categories = `[reflectionType]`;
- Ruins categories = `[traceType]`;
- missing tags = `[]`.

Do not search:

- full body text;
- Greenhouse temporary input;
- hidden or unpublished content.

Group results by Region.

## 17. Signature interactions

- Home: Garden Map + Where next?
- Garden: Bed filtering and search
- Forest: A question found you
- Lake: Something surfaced
- Ruins: See what grew from it
- Greenhouse: AI Seed Gardener

Do not add extra random interactions.

## 18. Visual consistency

All Regions share:

- typography;
- spacing;
- cards;
- buttons;
- navigation;
- footer;
- status badges;
- motion timing.

Regions may vary:

- background accent;
- decorative motif;
- iconography;
- light border and texture details.

Visual moods:

- Home: warm off-white, light green, soft wood
- Garden: young green, soil, soft yellow
- Forest: deep green, fog grey, low-saturation blue-green
- Lake: grey-blue, water blue, soft silver
- Ruins: stone grey, old paper, muted dark green
- Greenhouse: bright green, warm white, soft gold

## 19. Responsive requirements

- desktop and mobile must use different layout strategies;
- Home map becomes a vertical list on mobile;
- multi-column cards become single-column;
- hover-only information becomes visible on touch devices;
- paired actions stack vertically;
- decoration may be simplified or hidden;
- no horizontal overflow;
- Greenhouse input and result use full width on mobile;
- Garden Guide becomes full-screen or a bottom sheet.

## 20. Accessibility requirements

- semantic heading order;
- keyboard navigation;
- visible focus states;
- accessible icon labels;
- adequate contrast;
- no colour-only communication;
- accessible textarea label;
- live regions for AI states;
- `prefers-reduced-motion`;
- important content not hidden behind hover;
- keyboard-activatable cards.

## 21. Animation limits

Allowed:

- fade;
- small movement;
- path highlight;
- gentle ripple;
- small sprout animation;
- subtle compass rotation.

Forbidden:

- complex 3D;
- large particles;
- mouse-following;
- long loading sequences;
- strong bouncing;
- continuous full-page animation;
- background video.

Maximum one main environmental animation per Region.

Unconfirmed imagery may use CSS, SVG, geometry, and abstract decoration. Do not download unconfirmed personal images or generate imagery that implies real personal experiences.

## 22. Version 1 exclusions

Do not build:

- accounts;
- database content storage;
- comments;
- likes;
- saved AI history;
- automatic publishing;
- CMS;
- dark mode;
- language switching;
- seasonal themes;
- dynamic relation graph;
- automatic status calculation;
- full-text search;
- uploads;
- voice input;
- model selector;
- community sharing;
- site-wide random compass;
- complex revisit personalisation.

## 23. Acceptance criteria

Version 1 is complete when:

- all eight main pages load;
- all six Regions are reachable from Garden Guide;
- Home map works on desktop and mobile;
- Garden filtering and search work;
- Forest filtering and random Question work;
- Lake filtering and random Reflection work;
- Ruins related-growth links work;
- Greenhouse returns valid structured output;
- Greenhouse handles empty, loading, success, and error states;
- Forest prefill works;
- Garden Index includes all four content types;
- Search returns title, summary, category, and tag matches;
- all cards lead to full or short detail pages;
- no valid CTA leads to 404;
- keyboard navigation works;
- mobile pages do not overflow;
- reduced-motion mode remains usable;
- no secret appears client-side;
- no personal information is invented.
