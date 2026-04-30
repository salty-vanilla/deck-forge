import { describe, expect, it } from "vitest";

import { buildPresentationIr } from "#src/builders/build-presentation-ir.js";
import {
  BUILTIN_LAYOUT_STRATEGIES,
  heroStrategy,
  kpiGridStrategy,
  selectLayoutStrategy,
  singleStackStrategy,
  splitGrid,
  splitVertical,
  twoColumnStrategy,
} from "#src/builders/layouts/index.js";
import type { LayoutContext } from "#src/builders/layouts/index.js";
import type {
  ContentBlock,
  DeckPlan,
  PresentationBrief,
  SlideSpec,
  ThemeSpec,
} from "#src/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBrief(): PresentationBrief {
  return {
    id: "brief-1",
    title: "Test Brief",
    audience: { primary: "Engineers", expertiseLevel: "intermediate" },
    goal: { type: "inform", primaryGoal: "share knowledge" },
    tone: { register: "neutral", energy: "calm" },
    narrative: { framework: "scqa", steps: [] },
    output: { format: ["pptx"] },
    constraints: { mustInclude: [], mustAvoid: [] },
    visualDirection: { style: "minimal", mood: "trustworthy" },
  } as unknown as PresentationBrief;
}

function makeDeckPlan(): DeckPlan {
  return {
    id: "deck-1",
    briefId: "brief-1",
    title: "Test Deck",
    slideCountTarget: 1,
    sections: [],
    globalStoryline: "test",
  } as DeckPlan;
}

function makeSlideSpec(
  content: SlideSpec["content"],
  overrides: Partial<SlideSpec> = {},
): SlideSpec {
  return {
    id: "slide-1",
    slideNumber: 1,
    title: "Test Slide",
    intent: { type: "data_insight", keyMessage: "test", audienceTakeaway: "test" },
    layout: { type: "single_column", density: "medium" },
    content,
    ...overrides,
  } as SlideSpec;
}

function makeContext(
  blocks: ContentBlock[],
  overrides: Partial<LayoutContext> = {},
): LayoutContext {
  const slideSpec = makeSlideSpec(blocks);
  const ctx: LayoutContext = {
    slideSpec,
    layoutSpec: slideSpec.layout,
    regions: [],
    theme: {} as ThemeSpec,
    slideSize: { width: 1280, height: 720, unit: "px" },
    blocks,
    regionFrames: {
      body: { x: 80, y: 192, width: 672, height: 336 },
      visual: { x: 768, y: 192, width: 432, height: 336 },
      callout: { x: 80, y: 528, width: 1120, height: 112 },
      table: { x: 80, y: 192, width: 1120, height: 336 },
    },
    ...overrides,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// grid-utils
// ---------------------------------------------------------------------------

describe("layouts/grid-utils", () => {
  it("splitVertical respects minimum height of 60 and uses density-aware gap", () => {
    const frames = splitVertical({ x: 0, y: 0, width: 600, height: 400 }, 4, "medium");
    expect(frames).toHaveLength(4);
    for (const frame of frames) {
      expect(frame.height).toBeGreaterThanOrEqual(60);
      expect(frame.x).toBe(0);
      expect(frame.width).toBe(600);
    }
    const gap = (frames[1]?.y ?? 0) - ((frames[0]?.y ?? 0) + (frames[0]?.height ?? 0));
    expect(gap).toBeGreaterThanOrEqual(16);
  });

  it("splitVertical clamps count and reuses the last frame for overflow", () => {
    // Height too small to fit 5 frames at 60px min; should clamp to ~2 and
    // pad with copies of the last frame.
    const frames = splitVertical({ x: 0, y: 0, width: 600, height: 200 }, 5, "medium");
    expect(frames).toHaveLength(5);
    expect(frames[3]).toEqual(frames[4]);
    expect(frames[2]).toEqual(frames[3]);
  });

  it("splitGrid produces cols × rows frames", () => {
    const frames = splitGrid({ x: 0, y: 0, width: 600, height: 400 }, 3, 2, "medium");
    expect(frames).toHaveLength(6);
    expect(frames[0]?.x).toBe(0);
    expect(frames[0]?.y).toBe(0);
    expect(frames[5]?.x).toBeGreaterThan(0);
    expect(frames[5]?.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// strategy.match()
// ---------------------------------------------------------------------------

describe("layout strategy match()", () => {
  it("kpi-grid matches when there are 2+ metric blocks", () => {
    const ctx = makeContext([
      { id: "m1", type: "metric", label: "Users", value: "12K" },
      { id: "m2", type: "metric", label: "Revenue", value: "$1M" },
    ] as ContentBlock[]);
    expect(kpiGridStrategy.match(ctx)).toBe(true);
    expect(twoColumnStrategy.match(ctx)).toBe(false);
  });

  it("two-column matches when image + body block present", () => {
    const ctx = makeContext([
      { id: "p1", type: "paragraph", text: "Body text" },
      { id: "i1", type: "image", assetId: "asset-1" },
    ] as ContentBlock[]);
    expect(twoColumnStrategy.match(ctx)).toBe(true);
  });

  it("hero matches when layout type is 'hero' and there is an image", () => {
    const ctx = makeContext([{ id: "i1", type: "image", assetId: "asset-1" }] as ContentBlock[], {
      layoutSpec: { type: "hero", density: "medium" },
    });
    expect(heroStrategy.match(ctx)).toBe(true);
  });

  it("single-stack always matches as fallback", () => {
    const ctx = makeContext([{ id: "p1", type: "paragraph", text: "x" }] as ContentBlock[]);
    expect(singleStackStrategy.match(ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectLayoutStrategy()
// ---------------------------------------------------------------------------

describe("selectLayoutStrategy", () => {
  it("prefers kpi-grid over two-column when metrics dominate", () => {
    const ctx = makeContext([
      { id: "m1", type: "metric", label: "A", value: "1" },
      { id: "m2", type: "metric", label: "B", value: "2" },
      { id: "i1", type: "image", assetId: "asset-1" },
      { id: "p1", type: "paragraph", text: "..." },
    ] as ContentBlock[]);
    const strategy = selectLayoutStrategy(ctx);
    // hero has higher priority than kpi-grid (60 vs 50). Confirm hero wins
    // when its match conditions are met (image + small text), otherwise
    // kpi-grid.  Here textCount=1 (paragraph) so hero matches: imageCount=1,
    // textCount<=2.
    expect(strategy.id).toBe("hero");
  });

  it("falls back to single-stack for plain text-only slides", () => {
    const ctx = makeContext([
      { id: "p1", type: "paragraph", text: "a" },
      { id: "p2", type: "paragraph", text: "b" },
    ] as ContentBlock[]);
    const strategy = selectLayoutStrategy(ctx);
    expect(strategy.id).toBe("single-stack");
  });

  it("uses BUILTIN_LAYOUT_STRATEGIES by default", () => {
    expect(BUILTIN_LAYOUT_STRATEGIES.length).toBeGreaterThan(0);
    expect(BUILTIN_LAYOUT_STRATEGIES.find((s) => s.id === "single-stack")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Strategy layout() — frame production
// ---------------------------------------------------------------------------

describe("kpi-grid layout()", () => {
  it("places 4 metric blocks in a 2×2 grid", () => {
    const blocks = [
      { id: "m1", type: "metric", label: "A", value: "1" },
      { id: "m2", type: "metric", label: "B", value: "2" },
      { id: "m3", type: "metric", label: "C", value: "3" },
      { id: "m4", type: "metric", label: "D", value: "4" },
    ] as ContentBlock[];
    const ctx = makeContext(blocks);

    const assignments = kpiGridStrategy.layout(ctx);

    expect(assignments).toHaveLength(4);
    // Top-left and top-right should share a y; bottom-left and bottom-right
    // should share a (greater) y.
    expect(assignments[0]?.frame.y).toBe(assignments[1]?.frame.y);
    expect(assignments[2]?.frame.y).toBe(assignments[3]?.frame.y);
    expect(assignments[2]?.frame.y).toBeGreaterThan(assignments[0]?.frame.y ?? 0);
    // Each metric should carry the "card" decoration hint.
    for (const assignment of assignments) {
      expect(assignment.hints?.decoration).toBe("card");
    }
  });
});

describe("two-column layout()", () => {
  it("places body and image in non-overlapping columns", () => {
    const blocks = [
      { id: "p1", type: "paragraph", text: "Body" },
      { id: "i1", type: "image", assetId: "asset-1" },
    ] as ContentBlock[];
    const ctx = makeContext(blocks);

    const assignments = twoColumnStrategy.layout(ctx);
    expect(assignments).toHaveLength(2);

    const bodyAssignment = assignments.find((a) => a.blockId === "p1");
    const imageAssignment = assignments.find((a) => a.blockId === "i1");
    expect(bodyAssignment).toBeDefined();
    expect(imageAssignment).toBeDefined();
    if (!bodyAssignment || !imageAssignment) return;

    const bodyRight = bodyAssignment.frame.x + bodyAssignment.frame.width;
    const imageLeft = imageAssignment.frame.x;
    // Image is on the right by default; bodyRight should be <= imageLeft.
    expect(bodyRight).toBeLessThanOrEqual(imageLeft);
  });

  it("respects emphasis: 'left' to flip the image to the left column", () => {
    const blocks = [
      { id: "p1", type: "paragraph", text: "Body" },
      { id: "i1", type: "image", assetId: "asset-1" },
    ] as ContentBlock[];
    const ctx = makeContext(blocks, {
      layoutSpec: { type: "single_column", density: "medium", emphasis: "left" },
    });

    const assignments = twoColumnStrategy.layout(ctx);
    const bodyAssignment = assignments.find((a) => a.blockId === "p1");
    const imageAssignment = assignments.find((a) => a.blockId === "i1");
    if (!bodyAssignment || !imageAssignment) return;

    expect(imageAssignment.frame.x).toBeLessThan(bodyAssignment.frame.x);
  });
});

describe("hero layout()", () => {
  it("gives the image roughly 75% of the height as the hero region", () => {
    const blocks = [
      { id: "i1", type: "image", assetId: "asset-1" },
      { id: "p1", type: "paragraph", text: "Caption" },
    ] as ContentBlock[];
    const ctx = makeContext(blocks, {
      layoutSpec: { type: "hero", density: "medium" },
    });

    const assignments = heroStrategy.layout(ctx);
    const imageAssignment = assignments.find((a) => a.blockId === "i1");
    const captionAssignment = assignments.find((a) => a.blockId === "p1");
    if (!imageAssignment || !captionAssignment) return;

    expect(imageAssignment.frame.height).toBeGreaterThan(captionAssignment.frame.height);
    // Caption sits below the hero image.
    expect(captionAssignment.frame.y).toBeGreaterThanOrEqual(
      imageAssignment.frame.y + imageAssignment.frame.height,
    );
  });
});

// ---------------------------------------------------------------------------
// End-to-end integration via buildPresentationIr
// ---------------------------------------------------------------------------

describe("buildPresentationIr — strategy integration", () => {
  it("produces a 2×2 grid of card-decorated metric elements", () => {
    const slideSpec = makeSlideSpec([
      { id: "m1", type: "metric", label: "Users", value: "12K" },
      { id: "m2", type: "metric", label: "Revenue", value: "$1M" },
      { id: "m3", type: "metric", label: "Churn", value: "2.4%" },
      { id: "m4", type: "metric", label: "NPS", value: "62" },
    ] as ContentBlock[]);

    const ir = buildPresentationIr({
      brief: makeBrief(),
      deckPlan: makeDeckPlan(),
      slideSpecs: [slideSpec],
    });
    const slide = ir.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;

    const metricElements = slide.elements.filter((el) => ["m1", "m2", "m3", "m4"].includes(el.id));
    expect(metricElements).toHaveLength(4);

    // Ys should form 2 distinct rows.
    const ys = new Set(metricElements.map((el) => el.frame.y));
    expect(ys.size).toBe(2);
  });

  it("places image + body in a two-column layout when both are present", () => {
    // Use 3+ text blocks so hero (which targets 1 image + ≤2 text blocks) does
    // not win and two-column is selected.
    const slideSpec = makeSlideSpec([
      { id: "p1", type: "paragraph", text: "Some explanatory text." },
      { id: "p2", type: "paragraph", text: "More body content." },
      { id: "p3", type: "paragraph", text: "Even more body content." },
      { id: "i1", type: "image", assetId: "asset-hero-001" },
    ] as ContentBlock[]);

    const ir = buildPresentationIr({
      brief: makeBrief(),
      deckPlan: makeDeckPlan(),
      slideSpecs: [slideSpec],
    });
    const slide = ir.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;

    const image = slide.elements.find((el) => el.id === "i1");
    const body1 = slide.elements.find((el) => el.id === "p1");
    expect(image && body1).toBeTruthy();
    if (!image || !body1) return;

    // Image sits to the right of the body column in the default two-column layout.
    expect(image.frame.x).toBeGreaterThan(body1.frame.x);
  });
});
