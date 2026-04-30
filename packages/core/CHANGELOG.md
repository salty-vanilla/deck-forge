# @deck-forge/core

## 0.2.3

### Bug Fixes

- **PptxExporter / `renderTextElement`** — `addText` is now invoked with
  `shrinkText: true`, a role-appropriate `valign` (`title`/`callout` →
  `middle`, `footer` → `bottom`, otherwise `top`), and `paraSpaceAfter` when
  the text contains bullets. This prevents PowerPoint from growing the text
  shape past its frame and bleeding into adjacent regions, which was the
  primary visible cause of element overlap in exported decks. `callout`-role
  text additionally receives a `fill` (theme `surface`) and a thin `line`
  (theme `secondary`/`textSecondary`) so it reads as a distinct block.
  Regression test: `src/__tests__/pptx-exporter.render-options.test.ts`.
- **buildPresentationIr / `bulletListToRichText`** — Bullet items are no
  longer flattened to `"  • …"` text prefixes. Each item becomes a
  `RichParagraph` with a new optional `bullet: { indentLevel }` flag and a
  `spacingAfter` of 6 so the PPTX exporter can drive PptxGenJS native bullets
  (`bullet: true` / `bullet: { indent: n }` + `indentLevel`). This restores
  proper bullet line-height and indentation for nested lists, which were
  cramped and overflowed their frame in 0.2.2.
  Regression tests: `src/__tests__/build-presentation-ir.bugfixes-0.2.3.test.ts`,
  `src/__tests__/pptx-exporter.render-options.test.ts`.
- **buildPresentationIr / `splitVertical`** — When 3 or more blocks share a
  region, the inter-block gap widens from 12 to 18, and every sub-frame is
  guaranteed at least 60 units of height. If the region is too small to
  satisfy the minimum, the block count is clamped and overflow blocks reuse
  the last sub-frame so they cannot spill into adjacent regions; the
  resulting overlap is surfaced as a layout warning instead of silently
  rendering on top of the next region.
  Regression test: `src/__tests__/build-presentation-ir.bugfixes-0.2.3.test.ts`.
- **buildPresentationIr / title layout** — The `"title"` layout now splits
  the title region vertically into a top 60 % (title element) and bottom 40 %
  (subtitle element) with an 8-unit gap, instead of placing the title across
  the full title region and overlaying the subtitle at the 62 % mark. Long
  titles can no longer collide with their subtitle.
  Regression test: `src/__tests__/build-presentation-ir.bugfixes-0.2.3.test.ts`.
- **PptxExporter / `renderImageElement`** — `addImage` now passes
  `sizing: { type: "contain", w, h }` so images are scaled inside their frame
  while preserving the source aspect ratio, instead of being stretched and
  potentially extending past the frame visually.
  Regression test: `src/__tests__/pptx-exporter.render-options.test.ts`.
- **validation/rules/layout** — Added a min-frame-height warning: any element
  with `frame.height < 60` produces a `warning` ("frame height … below the
  minimum readable height of 60"). Existing overlap, out-of-bounds, and
  margin rules are unchanged.

### Internal

- **`RichParagraph`** gains an optional `bullet?: { indentLevel?: number }`
  field. The change is additive and backwards compatible.

## 0.2.2

### Bug Fixes

- **buildPresentationIr / `defaultFrameForRole`** — Per-role layout frames no
  longer collapse to the same `{x:80, y:80, width:1120, height:560}` rectangle.
  `title`, `body`, `visual`, `callout`, `sidebar`, and `footer` now occupy
  distinct, non-overlapping zones within the slide. Previously every
  non-title/non-footer region rendered on top of the body region, so any slide
  with more than one block produced a stack of overlapping shapes. Regression
  test: `src/__tests__/default-frame-for-role.test.ts`.
- **buildPresentationIr** — `MetricBlock` content blocks are now rendered as
  callout-role text elements (`label\nvalue unit ↑/↓`). Previously they were
  silently dropped because `buildElements()` had no `metric` branch.
  Regression test: `src/__tests__/build-presentation-ir.bugfixes.test.ts` (Bug A).
- **buildPresentationIr / `createTheme`** — When `brief.brand.colors` is
  absent, the theme now derives its palette from `brief.visualDirection.mood`
  (`energetic`, `calm`, `trustworthy`, `futuristic`, `premium`, `practical`).
  Previously `visualDirection` was ignored and every brandless deck rendered
  with the same default blue. Brand colors still take precedence when
  explicitly provided. Regression test: `src/__tests__/build-presentation-ir.bugfixes.test.ts`
  (Bug C).
- **buildPresentationIr / `buildAssetRegistry`** — `slideSpec.assets[]`
  references and `assetSpec.targetSlideIds` no longer fabricate
  `asset-ref-*` / `asset-target-*` element IDs in `asset.usage[].elementId`.
  These phantom IDs caused the validator to emit "non-existent element"
  warnings for every asset that wasn't paired with a real `ImageElementIR`.
  Real image elements still get a proper usage entry. Regression test:
  `src/__tests__/build-presentation-ir.bugfixes.test.ts` (Bug D).

## 0.2.1

- Initial public release on npm.
