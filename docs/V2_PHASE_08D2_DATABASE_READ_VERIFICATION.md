# The Garden V2 — 08D-2 Database Read Verification

Task: `08D-2. Database Read Verification`  
Implementation date: `2026-07-19`  
Scope: read-only verification of the public database source adapter  
Content data modified: **no**  
Import executed: **no**  
Source mode changed: **no**

## Outcome

The automated content suite now exercises the public content service with its
source explicitly set to `database` and a deterministic repository fixture for
the completed 19-record V1 import. The coverage verifies the database-mode
mapping and public read boundary without connecting to Supabase or exposing a
write path.

No runtime source configuration, legacy source, Admin service, database schema,
migration, or content data was changed.

## Verified reads

Collection reads verify the exact imported route sets and counts:

- Garden: 5 Published records
- Forest: 5 Published records
- Lake: 5 Published records
- Ruins: 4 Published records
- all Regions: 19 Published records

Detail reads cover every imported slug:

- Garden: `building-the-garden`, `learning-psychological-statistics`,
  `exploring-ai-tools`, `python-starting-from-the-basics`, and
  `designing-better-slides-and-documents`
- Forest: `why-exploratory-websites-invite-more-clicks`,
  `does-ai-help-thinking-or-organize-answers`, `why-people-fear-forgetting`,
  `how-psychology-shapes-product-and-web-design`, and
  `when-a-question-moves-from-forest-to-garden`
- Lake: `reverse-1999`, `jung-and-mandala`, `the-garden`, `love-love-love`, and
  `summer-ghost`
- Ruins: `first-version-of-home`, `portfolio-never-built`,
  `too-much-interaction`, and `unfinished-continue`

For each detail, the test verifies route identity, Region, content type,
metadata availability, bilingual content fields, body mapping, categories, and
tags. All five Lake Reflections retain `growthStage = null`, meaning Growth
Stage is not applicable.

The four imported `grewInto` relations are loaded through database detail reads
and resolve to the expected Published targets.

## Preservation and safety

- The default source mode remains `legacy`.
- Explicit `legacy`, `dual`, and `database` behavior remains implemented by the
  existing source-cutover boundary.
- Database mode is proven not to read the legacy source during these reads.
- Admin modules and behavior are unchanged.
- No import command, database mutation, cutover, or legacy deletion is present
  in the verification path.

## Automated coverage

`tests/database-read-verification.test.cjs` is included in
`npm run test:content-admin`. It uses an injected read-only repository and the
public `createContentService` boundary. The fixture provides only repository
read methods; it has no import or mutation capability.

## Change manifest

Modified files:

- `docs/V2_TODO.md`
- `package.json`

New files:

- `docs/V2_PHASE_08D2_DATABASE_READ_VERIFICATION.md`
- `tests/database-read-verification.test.cjs`

Migrations created: **none**.
