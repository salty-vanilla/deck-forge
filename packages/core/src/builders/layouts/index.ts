import { heroStrategy } from "#src/builders/layouts/hero.js";
import { kpiGridStrategy } from "#src/builders/layouts/kpi-grid.js";
import { singleStackStrategy } from "#src/builders/layouts/single-stack.js";
import { twoColumnStrategy } from "#src/builders/layouts/two-column.js";
import type { LayoutContext, LayoutStrategy } from "#src/builders/layouts/types.js";

export type {
  LayoutContext,
  LayoutHints,
  LayoutStrategy,
  SubFrameAssignment,
} from "#src/builders/layouts/types.js";
export {
  gapForDensity,
  splitVertical,
  splitHorizontal,
  splitGrid,
  pickGridDimensions,
  MIN_SUBFRAME_HEIGHT,
} from "#src/builders/layouts/grid-utils.js";

/**
 * Built-in strategies, registered in priority order (highest first).  The
 * fallback `singleStackStrategy` is always last and always matches.
 */
export const BUILTIN_LAYOUT_STRATEGIES: readonly LayoutStrategy[] = Object.freeze([
  heroStrategy,
  kpiGridStrategy,
  twoColumnStrategy,
  singleStackStrategy,
]);

/**
 * Picks the highest-priority strategy whose `match()` returns true for the
 * given layout context.  Falls back to `singleStackStrategy`.
 */
export function selectLayoutStrategy(
  ctx: LayoutContext,
  strategies: readonly LayoutStrategy[] = BUILTIN_LAYOUT_STRATEGIES,
): LayoutStrategy {
  const sorted = [...strategies].sort((a, b) => b.priority - a.priority);
  for (const strategy of sorted) {
    if (strategy.match(ctx)) {
      return strategy;
    }
  }
  return singleStackStrategy;
}

export { heroStrategy, kpiGridStrategy, singleStackStrategy, twoColumnStrategy };
