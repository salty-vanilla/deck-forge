# @deck-forge/core

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
