# The Garden — Codex Project Instructions

## Source of truth

- Read `docs/MASTER_SPEC.md` before making structural or technical changes.
- Read `docs/CONTENT.md` before adding or editing visitor-facing text.
- Update `docs/TODO.md` after completing each development phase.
- If documents conflict, priority is:
  1. `docs/MASTER_SPEC.md`
  2. `docs/CONTENT.md`
  3. `docs/TODO.md`
  4. Existing implementation

## Core product rules

- Build The Garden as a personal digital garden, not a résumé or traditional portfolio.
- Preserve the six Regions: Home, Garden, Forest, Lake, Ruins, and Greenhouse.
- Keep Version 1 within the stated scope.
- Do not invent personal information, experiences, projects, preferences, dates, contact details, grades, awards, or research findings.
- Missing personal content must use a clear placeholder, be hidden, or be marked with a TODO.
- Internal component names must never be rendered as visible page titles.
- Visitor-facing names must follow the digital-garden language defined in `docs/CONTENT.md`.
- Every valid card and CTA must lead to a working full or short detail page.
- Do not add excluded features without explicit approval.

## Technical rules

- Use Next.js with TypeScript.
- Use a shared design system for typography, spacing, buttons, cards, navigation, footer, status badges, and animation timing.
- Keep API keys and AI provider calls server-side.
- Never expose secrets in client-side code.
- Do not add a database in Version 1.
- Prefer reusable components and shared content data.
- Support desktop and mobile layouts separately rather than simply shrinking desktop layouts.
- Support keyboard navigation, visible focus states, semantic headings, adequate contrast, and `prefers-reduced-motion`.

## Development workflow

- Work in phases from `docs/TODO.md`.
- Do not implement future phases early unless required for architecture.
- Before coding a phase, briefly state:
  - what will be built;
  - which files are likely to change;
  - any blocking ambiguity.
- After each phase:
  - run lint;
  - run TypeScript checking;
  - run the production build;
  - report changed files;
  - report test/build results;
  - update `docs/TODO.md`.
- Do not rewrite confirmed visible copy unless explicitly asked.
- Do not replace poetic visible names with generic labels such as “Projects,” “Blog,” “Categories,” or “Recent Posts.”

## First instruction

Before writing page code, inspect all documentation and provide:
1. technical conflicts or missing dependencies;
2. recommended project structure;
3. minimum dependencies;
4. implementation phases;
5. missing information that must not be invented.

Do not build the full site in a single task.
