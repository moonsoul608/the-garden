# Phase 07E — Frontend Polish

## Outcome and scope

Phase 07E completes a visual and UX-only public frontend polish pass. The V1
regional design language, visitor copy, route structure, public content data,
and all Admin workflows remain intact. No source-mode default, cutover control,
migration behavior, lifecycle rule, database schema, or production state was
changed.

## Responsive and consistency work

- Kept Region decoration intentionally clipped while preserving measurable
  document width at every audited viewport.
- Reduced desktop-oriented minimum card heights on mobile so reading order and
  spacing follow content length.
- Made the Top Bar sticky with a restrained translucent backdrop and contained
  Garden Guide overscroll.
- Kept paired mobile actions full-width and stacked, including Search empty
  actions.
- Added shared intrinsic media constraints and retained the existing bounded
  content widths for large screens.

## Content presentation

Published detail pages now present existing public DTO fields without changing
their values:

- optional approved covers render only when both a safe public URL and alt text
  exist;
- intrinsic dimensions and a fixed aspect ratio reserve cover space before
  load;
- categories, Growth Stage, tags, Published date, and Last tended date use
  semantic metadata markup;
- selected public Growth Notes render as a concise Growth Timeline;
- typed relations show their relationship, target Region and Content Type, and
  optional public note;
- legacy text-first detail pages remain text-first when no approved cover or
  public Growth Timeline exists;
- Archived relations retain the same limited resting-state boundary.

## Interaction and accessibility

- Added focus-visible parity to hover treatments for cards, map nodes, trail
  signs, samples, and relation paths.
- Restored an explicit visible focus treatment around the Garden search field
  and strengthened grouped Search focus presentation.
- Garden Guide navigation now closes the open panel after selecting a route.
- Error-state landmarks now have an explicit accessible heading relationship.
- Forced-colors focus and control borders retain visible system colors.
- Reduced-motion rules cover the new focus/hover transforms.

## Performance review

- Moved the static Home opening out of the client component module.
- Added no package, animation library, image library, or new client component.
- Covers use native responsive media with reserved dimensions, async decode,
  and high priority only on the detail-page hero; editor-approved HTTPS origins
  are not forced through an unsafe wildcard image optimizer configuration.
- The production build reports a 102 kB shared first-load bundle and a 193 B
  route payload for each public detail family.

## QA evidence

The existing browser audit passed:

- 96 route/viewport combinations at 320, 390, 500, 768, 1024, and 1440 CSS
  pixels with no horizontal overflow;
- 16 representative public routes with zero axe violations;
- keyboard activation and visible focus for navigation, filters, Search,
  Garden Guide, Greenhouse, and related paths;
- reduced motion with no remaining infinite animations.

Required checks:

```text
npm run typecheck             PASS
npm run lint                  PASS
npm run test:authorization    PASS (6/6)
npm run test:content-admin    PASS (182/182)
npm run build                 PASS (35/35 static pages generated)
git diff --check              PASS
```

The source-mode regression coverage passed for Legacy, Dual, and Database
contracts, including Published, Draft, Review, Archived, and unknown route
dispositions across all four content Regions. Admin regression coverage also
passed unchanged.

No production cutover was performed. No migration was created.
