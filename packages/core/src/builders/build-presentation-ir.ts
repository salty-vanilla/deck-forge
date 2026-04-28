import type {
  Asset,
  AssetMetadata,
  AssetSpec,
  AssetUsage,
  CalloutBlock,
  ContentBlock,
  DeckPlan,
  Id,
  LayoutSpec,
  ParagraphBlock,
  PresentationBrief,
  PresentationIR,
  ResolvedFrame,
  RichText,
  SlideIR,
  SlideSize,
  SlideSpec,
  TableBlock,
  TextElementIR,
  ThemeSpec,
  TitleBlock,
} from "#/index.js";
import { createResolvedRegions, defaultFrameForRole } from "#/operations/utils.js";

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const DEFAULT_SLIDE_SIZE: SlideSize = {
  width: 1280,
  height: 720,
  unit: "px",
};

export type BuildPresentationIrInput = {
  brief: PresentationBrief;
  deckPlan: DeckPlan;
  slideSpecs: SlideSpec[];
  assetSpecs?: AssetSpec[];
  id?: string;
  version?: string;
  title?: string;
  theme?: ThemeSpec;
  meta?: Partial<PresentationIR["meta"]>;
};

export type BuildPresentationIrOutput = PresentationIR;

export function buildPresentationIr(input: BuildPresentationIrInput): BuildPresentationIrOutput {
  const theme = input.theme ?? createTheme(input.brief);
  const usedElementIds = new Set<string>();
  const slideSpecs = [...input.slideSpecs].sort((left, right) => {
    const leftOrder = left.slideNumber ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.slideNumber ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.id.localeCompare(right.id);
  });

  const slides = slideSpecs.map((slideSpec, index) =>
    buildSlideIr(slideSpec, index, theme, usedElementIds),
  );
  const assets = buildAssetRegistry(input.assetSpecs ?? [], slides, slideSpecs);

  return {
    id: input.id ?? input.deckPlan.id,
    version: input.version ?? "1.0.0",
    meta: {
      title: input.title ?? (input.deckPlan.title || input.brief.title),
      createdAt: input.meta?.createdAt ?? DEFAULT_TIMESTAMP,
      updatedAt: input.meta?.updatedAt ?? DEFAULT_TIMESTAMP,
      author: input.meta?.author,
      source: input.meta?.source ?? input.brief.id,
    },
    brief: input.brief,
    deckPlan: input.deckPlan,
    theme,
    slides,
    assets: {
      assets,
    },
    operationLog: [
      {
        id: "op-1",
        timestamp: DEFAULT_TIMESTAMP,
        actor: "system",
        operation: {
          type: "build_presentation_ir",
          slideCount: slides.length,
          assetCount: assets.length,
        },
        result: "success",
      },
    ],
  };
}

function buildSlideIr(
  slideSpec: SlideSpec,
  index: number,
  theme: ThemeSpec,
  usedElementIds: Set<string>,
): SlideIR {
  const layout = {
    spec: slideSpec.layout,
    slideSize: DEFAULT_SLIDE_SIZE,
    regions: createResolvedRegions(slideSpec.layout, DEFAULT_SLIDE_SIZE),
  };
  const elements = buildElements(slideSpec, layout.spec, layout.regions, theme, usedElementIds);

  return {
    id: slideSpec.id,
    index,
    specId: slideSpec.id,
    title: slideSpec.title,
    intent: slideSpec.intent,
    layout,
    elements,
    speakerNotes: slideSpec.speakerNotes?.text,
  };
}

function buildElements(
  slideSpec: SlideSpec,
  layoutSpec: LayoutSpec,
  regions: SlideIR["layout"]["regions"],
  theme: ThemeSpec,
  usedElementIds: Set<string>,
): SlideIR["elements"] {
  const content = [...slideSpec.content];
  const titleBlock = firstBlockByType(content, "title");
  const ensuredTitleText = titleBlock?.text || slideSpec.title;

  if (ensuredTitleText) {
    const synthesizedTitle: TitleBlock = {
      id: titleBlock?.id ?? `${slideSpec.id}-title`,
      type: "title",
      text: ensuredTitleText,
      emphasis: titleBlock?.emphasis,
    };
    if (!titleBlock) {
      content.unshift(synthesizedTitle);
    } else {
      const firstTitleIndex = content.findIndex((block) => block.id === titleBlock.id);
      if (firstTitleIndex > 0) {
        content.splice(firstTitleIndex, 1);
        content.unshift(synthesizedTitle);
      }
    }
  }

  const titledLayoutType = layoutSpec.type;
  const titleRegionFrame = frameForRole(regions, "title");
  const bodyRegionFrame = frameForRole(regions, "body");
  const tableRegionFrame = frameForRole(regions, "table");
  const visualRegionFrame = frameForRole(regions, "visual");
  const calloutRegionFrame = frameForRole(regions, "callout");
  const subtitleBaseFrame =
    titledLayoutType === "title"
      ? {
          x: titleRegionFrame.x,
          y: titleRegionFrame.y + Math.round(titleRegionFrame.height * 0.62),
          width: titleRegionFrame.width,
          height: Math.max(42, Math.round(titleRegionFrame.height * 0.34)),
        }
      : bodyRegionFrame;

  const bodyBlocks = content.filter(
    (block) => block.type === "paragraph" || block.type === "bullet_list",
  );
  const tableBlocks = content.filter((block) => block.type === "table");
  const imageBlocks = content.filter((block) => block.type === "image");
  const calloutBlocks = content.filter((block) => block.type === "callout");

  const bodyFrames = splitVertical(bodyRegionFrame, bodyBlocks.length || 1);
  const tableFrames = splitVertical(tableRegionFrame, tableBlocks.length || 1);
  const imageFrames = splitVertical(visualRegionFrame, imageBlocks.length || 1);
  const calloutFrames = splitVertical(calloutRegionFrame, calloutBlocks.length || 1);

  const elements: SlideIR["elements"] = [];
  let bodyIndex = 0;
  let tableIndex = 0;
  let imageIndex = 0;
  let calloutIndex = 0;

  for (const block of content) {
    if (block.type === "title") {
      elements.push(
        createTextElement({
          blockId: block.id,
          text: block.text,
          role: "title",
          frame: titleRegionFrame,
          style: {
            fontFamily: theme.typography.fontFamily.heading,
            fontSize: theme.typography.fontSize.title,
            color: theme.colors.textPrimary,
            bold: true,
          },
          usedElementIds,
        }),
      );
      continue;
    }

    if (block.type === "subtitle") {
      elements.push(
        createTextElement({
          blockId: block.id,
          text: block.text,
          role: "subtitle",
          frame: subtitleBaseFrame,
          style: {
            fontFamily: theme.typography.fontFamily.heading,
            fontSize: theme.typography.fontSize.heading,
            color: theme.colors.textSecondary,
          },
          usedElementIds,
        }),
      );
      continue;
    }

    if (block.type === "paragraph") {
      elements.push(
        createTextElement({
          blockId: block.id,
          text: block.text,
          role: "body",
          frame: bodyFrames[bodyIndex] ?? bodyRegionFrame,
          style: {
            fontFamily: theme.typography.fontFamily.body,
            fontSize: theme.typography.fontSize.body,
            color: theme.colors.textPrimary,
            lineHeight: theme.typography.lineHeight.normal,
          },
          usedElementIds,
        }),
      );
      bodyIndex += 1;
      continue;
    }

    if (block.type === "bullet_list") {
      elements.push(
        createTextElement({
          blockId: block.id,
          text: bulletListToRichText(block),
          role: "body",
          frame: bodyFrames[bodyIndex] ?? bodyRegionFrame,
          style: {
            fontFamily: theme.typography.fontFamily.body,
            fontSize: theme.typography.fontSize.body,
            color: theme.colors.textPrimary,
          },
          usedElementIds,
        }),
      );
      bodyIndex += 1;
      continue;
    }

    if (block.type === "table") {
      elements.push({
        id: ensureUniqueId(block.id, usedElementIds),
        type: "table",
        frame: tableFrames[tableIndex] ?? tableRegionFrame,
        headers: block.headers,
        rows: normalizeTableRows(block),
        style: {
          headerFill: theme.colors.surface,
          borderColor: theme.colors.secondary,
          textStyle: {
            fontFamily: theme.typography.fontFamily.body,
            fontSize: theme.typography.fontSize.caption,
            color: theme.colors.textPrimary,
          },
        },
      });
      tableIndex += 1;
      continue;
    }

    if (block.type === "image") {
      elements.push({
        id: ensureUniqueId(block.id, usedElementIds),
        type: "image",
        assetId: block.assetId,
        role: "inline",
        frame: imageFrames[imageIndex] ?? visualRegionFrame,
      });
      imageIndex += 1;
      continue;
    }

    if (block.type === "callout") {
      elements.push(
        createTextElement({
          blockId: block.id,
          text: block.text,
          role: "callout",
          frame: calloutFrames[calloutIndex] ?? calloutRegionFrame,
          style: {
            fontFamily: theme.typography.fontFamily.body,
            fontSize: theme.typography.fontSize.body,
            color: toneColor(block, theme),
            bold: true,
          },
          usedElementIds,
        }),
      );
      calloutIndex += 1;
    }
  }

  return elements;
}

function buildAssetRegistry(
  assetSpecs: AssetSpec[],
  slides: SlideIR[],
  slideSpecs: SlideSpec[],
): Asset[] {
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const imageUsageByAsset = collectImageUsages(slides);
  const slideRefsByAsset = collectSlideAssetRefs(slideSpecs);
  const builtAssets = new Map<string, Asset>();

  for (const spec of assetSpecs) {
    const asset = toAsset(spec, imageUsageByAsset, slideRefsByAsset, knownSlideIds);
    builtAssets.set(asset.id, asset);
  }

  for (const [assetId, usages] of imageUsageByAsset.entries()) {
    if (builtAssets.has(assetId)) {
      continue;
    }

    builtAssets.set(assetId, {
      id: assetId,
      type: "image",
      uri: `placeholder://${assetId}.png`,
      mimeType: "image/png",
      metadata: {
        source: "derived",
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: usages,
    });
  }

  return [...builtAssets.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function collectImageUsages(slides: SlideIR[]): Map<Id, AssetUsage[]> {
  const usageByAsset = new Map<Id, AssetUsage[]>();

  for (const slide of slides) {
    for (const element of slide.elements) {
      if (element.type !== "image") {
        continue;
      }

      const usage: AssetUsage = {
        slideId: slide.id,
        elementId: element.id,
        role: element.role ?? "inline",
      };

      const current = usageByAsset.get(element.assetId) ?? [];
      current.push(usage);
      usageByAsset.set(element.assetId, dedupeUsages(current));
    }
  }

  return usageByAsset;
}

function collectSlideAssetRefs(slideSpecs: SlideSpec[]): Map<Id, AssetUsage[]> {
  const usageByAsset = new Map<Id, AssetUsage[]>();

  for (const slide of slideSpecs) {
    for (const reference of slide.assets ?? []) {
      const usage: AssetUsage = {
        slideId: slide.id,
        elementId: `asset-ref-${slide.id}-${reference.assetId}`,
        role: reference.role,
      };
      const current = usageByAsset.get(reference.assetId) ?? [];
      current.push(usage);
      usageByAsset.set(reference.assetId, dedupeUsages(current));
    }
  }

  return usageByAsset;
}

function toAsset(
  spec: AssetSpec,
  imageUsageByAsset: Map<Id, AssetUsage[]>,
  slideRefsByAsset: Map<Id, AssetUsage[]>,
  knownSlideIds: Set<Id>,
): Asset {
  const usage = dedupeUsages([
    ...(imageUsageByAsset.get(spec.id) ?? []),
    ...(slideRefsByAsset.get(spec.id) ?? []),
  ]);
  if (spec.type === "generated_image") {
    return {
      id: spec.id,
      specId: spec.id,
      type: "image",
      uri: `generated://${spec.id}.png`,
      mimeType: "image/png",
      metadata: {
        width: spec.resolution?.width,
        height: spec.resolution?.height,
        source: "generated",
        generator: "core-builder",
        prompt: spec.prompt,
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "hero", knownSlideIds),
    };
  }

  if (spec.type === "external_image") {
    return {
      id: spec.id,
      specId: spec.id,
      type: "image",
      uri: spec.uri,
      mimeType: "image/png",
      metadata: {
        source: "external",
        provider: spec.provider,
        author: spec.author,
        license: spec.license,
        sourcePageUrl: spec.sourcePageUrl,
        attributionRequired: spec.attributionRequired,
        attributionText: spec.attributionText,
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "inline", knownSlideIds),
    };
  }

  if (spec.type === "retrieved_image") {
    return {
      id: spec.id,
      specId: spec.id,
      type: "image",
      uri: spec.selected?.imageUrl ?? `placeholder://${spec.id}.png`,
      mimeType: "image/png",
      metadata: {
        source: "external",
        provider: spec.provider,
        author: spec.selected?.author,
        license: spec.selected?.license,
        sourcePageUrl: spec.selected?.sourcePageUrl,
        attributionRequired: spec.selected?.attributionRequired,
        attributionText: spec.selected?.attributionText,
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "inline", knownSlideIds),
    };
  }

  if (spec.type === "diagram") {
    return {
      id: spec.id,
      specId: spec.id,
      type: "diagram",
      uri: `generated://${spec.id}.svg`,
      mimeType: "image/svg+xml",
      metadata: {
        source: "derived",
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "diagram", knownSlideIds),
    };
  }

  if (spec.type === "icon") {
    return {
      id: spec.id,
      specId: spec.id,
      type: "icon",
      uri: `generated://${spec.id}.svg`,
      mimeType: "image/svg+xml",
      metadata: {
        source: "derived",
        createdAt: DEFAULT_TIMESTAMP,
      },
      usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "icon", knownSlideIds),
    };
  }

  return {
    id: spec.id,
    specId: spec.id,
    type: "image",
    uri: `generated://${spec.id}.png`,
    mimeType: "image/png",
    metadata: {
      source: "derived",
      createdAt: DEFAULT_TIMESTAMP,
    },
    usage: mergeTargetSlideUsage(usage, spec.targetSlideIds, "inline", knownSlideIds),
  };
}

function mergeTargetSlideUsage(
  usage: AssetUsage[],
  targetSlideIds: Id[] | undefined,
  role: AssetUsage["role"],
  knownSlideIds: Set<Id>,
): AssetUsage[] {
  if (!targetSlideIds || targetSlideIds.length === 0) {
    return usage;
  }

  const targetUsages = targetSlideIds
    .filter((slideId) => knownSlideIds.has(slideId))
    .map((slideId) => ({
      slideId,
      elementId: `asset-target-${slideId}`,
      role,
    }));
  return dedupeUsages([...usage, ...targetUsages]);
}

function dedupeUsages(usages: AssetUsage[]): AssetUsage[] {
  const seen = new Set<string>();
  const deduped: AssetUsage[] = [];

  for (const usage of usages) {
    const key = `${usage.slideId}::${usage.elementId}::${usage.role}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(usage);
  }

  return deduped;
}

function createTheme(brief: PresentationBrief): ThemeSpec {
  const brandColors = brief.brand?.colors;
  const headingFont = brief.brand?.fonts?.heading ?? "Arial";
  const bodyFont = brief.brand?.fonts?.body ?? "Arial";
  const monoFont = brief.brand?.fonts?.mono ?? "Courier New";

  return {
    id: `theme-${slugify(brief.id)}`,
    name: brief.brand?.name ?? "Core Default",
    colors: {
      background: brandColors?.background ?? "#FFFFFF",
      surface: brandColors?.surface ?? "#F8FAFC",
      textPrimary: brandColors?.textPrimary ?? "#0F172A",
      textSecondary: brandColors?.textSecondary ?? "#475569",
      primary: brandColors?.primary ?? "#1D4ED8",
      secondary: brandColors?.secondary ?? "#0EA5E9",
      accent: brandColors?.accent ?? "#14B8A6",
      success: brandColors?.success,
      warning: brandColors?.warning,
      danger: brandColors?.danger,
      chartPalette: brandColors?.chartPalette ?? ["#1D4ED8", "#0EA5E9", "#14B8A6", "#F59E0B"],
    },
    typography: {
      fontFamily: {
        heading: headingFont,
        body: bodyFont,
        mono: monoFont,
      },
      fontSize: {
        title: 40,
        heading: 28,
        body: 18,
        caption: 14,
        footnote: 12,
      },
      lineHeight: {
        tight: 1.1,
        normal: 1.4,
        relaxed: 1.7,
      },
      weight: {
        regular: 400,
        medium: 500,
        bold: 700,
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    radius: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      full: 999,
    },
    slideDefaults: {
      backgroundColor: brandColors?.background ?? "#FFFFFF",
      padding: 24,
    },
    elementDefaults: {
      text: {
        fontFamily: bodyFont,
        fontSize: 18,
        color: brandColors?.textPrimary ?? "#0F172A",
      },
    },
  };
}

function createTextElement(input: {
  blockId: string;
  text: string | RichText;
  role: TextElementIR["role"];
  frame: ResolvedFrame;
  style: TextElementIR["style"];
  usedElementIds: Set<string>;
}): TextElementIR {
  return {
    id: ensureUniqueId(input.blockId, input.usedElementIds),
    type: "text",
    role: input.role,
    text: typeof input.text === "string" ? toRichText(input.text) : input.text,
    frame: input.frame,
    style: input.style,
  };
}

function toRichText(text: string): RichText {
  return {
    paragraphs: [
      {
        runs: [{ text }],
      },
    ],
  };
}

function bulletListToRichText(block: Extract<ContentBlock, { type: "bullet_list" }>): RichText {
  const lines: string[] = [];

  const visit = (items: typeof block.items, depth: number): void => {
    for (const item of items) {
      const indent = "  ".repeat(depth);
      lines.push(`${indent}• ${item.text}`);
      if (item.children && item.children.length > 0) {
        visit(item.children, depth + 1);
      }
    }
  };

  visit(block.items, 0);

  return {
    paragraphs: lines.map((line) => ({
      runs: [{ text: line }],
    })),
  };
}

function normalizeTableRows(block: TableBlock): string[][] {
  const columns = block.headers.length;
  return block.rows.map((row) => {
    if (row.length === columns) {
      return row;
    }

    if (row.length > columns) {
      return row.slice(0, columns);
    }

    const padded = [...row];
    while (padded.length < columns) {
      padded.push("");
    }
    return padded;
  });
}

function toneColor(block: CalloutBlock, theme: ThemeSpec): string {
  if (block.tone === "success") {
    return theme.colors.success ?? theme.colors.accent;
  }
  if (block.tone === "warning") {
    return theme.colors.warning ?? theme.colors.accent;
  }
  if (block.tone === "danger") {
    return theme.colors.danger ?? theme.colors.accent;
  }
  return theme.colors.accent;
}

function frameForRole(
  regions: SlideIR["layout"]["regions"],
  role: SlideIR["layout"]["regions"][number]["role"],
): ResolvedFrame {
  const match = regions.find((region) => region.role === role);
  if (match) {
    return match.frame;
  }
  return defaultFrameForRole(role, DEFAULT_SLIDE_SIZE);
}

function splitVertical(frame: ResolvedFrame, count: number): ResolvedFrame[] {
  if (count <= 1) {
    return [frame];
  }

  const gap = 12;
  const totalGap = gap * (count - 1);
  const slotHeight = Math.max(44, Math.floor((frame.height - totalGap) / count));
  const frames: ResolvedFrame[] = [];

  for (let index = 0; index < count; index += 1) {
    frames.push({
      x: frame.x,
      y: frame.y + index * (slotHeight + gap),
      width: frame.width,
      height: slotHeight,
    });
  }

  return frames;
}

function ensureUniqueId(id: string, usedIds: Set<string>): string {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  let suffix = 2;
  let next = `${id}-${suffix}`;
  while (usedIds.has(next)) {
    suffix += 1;
    next = `${id}-${suffix}`;
  }
  usedIds.add(next);
  return next;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function firstBlockByType<T extends ContentBlock["type"]>(
  blocks: ContentBlock[],
  type: T,
): Extract<ContentBlock, { type: T }> | undefined {
  return blocks.find((block): block is Extract<ContentBlock, { type: T }> => block.type === type);
}
