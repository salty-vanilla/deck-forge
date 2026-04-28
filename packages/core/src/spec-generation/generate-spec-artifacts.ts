import type {
  AssetSpec,
  ContentBlock,
  DeckPlan,
  DeckSection,
  GoalSpec,
  LayoutSpec,
  PresentationBrief,
  SlideIntent,
  SlidePlan,
  SlideSpec,
  ToneSpec,
  VisualDirectionSpec,
} from "#/index.js";
import type {
  CreatePresentationSpecInput,
  CreatePresentationSpecOutput,
  GenerateAssetPlanInput,
  GenerateAssetPlanOutput,
  GenerateDeckPlanInput,
  GenerateDeckPlanOutput,
  GenerateSlideSpecsInput,
  GenerateSlideSpecsOutput,
} from "#/spec-generation/types.js";

export async function createPresentationSpec(
  input: CreatePresentationSpecInput,
): Promise<CreatePresentationSpecOutput> {
  const timestamp = new Date().toISOString();
  const briefId = `brief-${slugifyTitle(input.userRequest)}`;
  const title = toTitle(input.userRequest);
  const slideCount = clampSlideCount(input.slideCount);
  const outputFormat = input.outputFormat ?? "pptx";

  const brief: PresentationBrief = {
    id: briefId,
    title,
    audience: {
      primary: input.audience ?? "general stakeholders",
      expertiseLevel: "intermediate",
      expectedConcern: ["impact", "risks", "next actions"],
    },
    goal: parseGoal(input.goal ?? input.userRequest),
    context: `Generated from request at ${timestamp}`,
    tone: parseTone(input.tone),
    narrative: {
      structure: "proposal",
      arc: [
        { role: "hook", message: `Why ${title} matters now` },
        { role: "insight", message: "Current state and key observations" },
        { role: "solution", message: "Recommended approach" },
        { role: "impact", message: "Expected outcomes and KPIs" },
        { role: "call_to_action", message: "Decisions and next steps" },
      ],
    },
    output: {
      formats: [outputFormat],
      aspectRatio: "16:9",
      language: "en",
    },
    constraints: {
      slideCount,
      minSlideCount: Math.max(3, slideCount - 2),
      maxSlideCount: Math.max(4, slideCount + 2),
    },
    visualDirection: {
      style: "corporate",
      mood: "trustworthy",
      colorMood: "clean and high contrast",
      composition: "clear hierarchy with whitespace",
      avoid: ["overly decorative backgrounds"],
    },
  };

  return { brief };
}

export async function generateDeckPlan(
  input: GenerateDeckPlanInput,
): Promise<GenerateDeckPlanOutput> {
  const { brief } = input;
  const slideCountTarget = clampSlideCount(brief.constraints.slideCount);
  const deckId = `deck-plan-${slugifyTitle(brief.title)}`;
  const slides = buildSlidePlans(slideCountTarget, brief);
  const sections = toSections(slides);

  const deckPlan: DeckPlan = {
    id: deckId,
    briefId: brief.id,
    title: brief.title,
    slideCountTarget,
    sections,
    globalStoryline: `${brief.goal.mainMessage} -> ${brief.goal.desiredOutcome}`,
  };

  return { deckPlan };
}

export async function generateSlideSpecs(
  input: GenerateSlideSpecsInput,
): Promise<GenerateSlideSpecsOutput> {
  const { brief, deckPlan } = input;
  const slideSpecs: SlideSpec[] = flattenSlides(deckPlan).map((slidePlan, index) => {
    const layout = toLayout(slidePlan.intent);
    const content = toContent(slidePlan, layout);
    const assets = slidePlan.assetRequirements?.map((requirement) => ({
      assetId: `asset-${slidePlan.id}-${requirement.purpose}`,
      role: requirement.purpose === "icon" ? ("icon" as const) : ("hero" as const),
    }));

    return {
      id: slidePlan.id,
      slideNumber: index + 1,
      title: slidePlan.title,
      intent: slidePlan.intent,
      layout,
      content,
      assets,
      speakerNotes: {
        text: `${brief.goal.mainMessage}. ${slidePlan.intent.audienceTakeaway}.`,
      },
    };
  });

  return { slideSpecs };
}

export async function generateAssetPlan(
  input: GenerateAssetPlanInput,
): Promise<GenerateAssetPlanOutput> {
  const { brief, slideSpecs } = input;
  const assetSpecs: AssetSpec[] = [];

  for (const slide of slideSpecs) {
    const needsVisual =
      slide.layout.type === "hero" ||
      slide.layout.type === "image_left_text_right" ||
      slide.layout.type === "text_left_image_right" ||
      slide.layout.type === "comparison" ||
      slide.content.some((block) => block.type === "image");

    if (!needsVisual) {
      continue;
    }

    const resolvedMode = resolveAssetAcquisitionMode({
      mode: input.acquisitionMode ?? "auto",
      visualDirection: brief.visualDirection,
    });

    if (resolvedMode === "retrieve") {
      assetSpecs.push({
        id: `asset-${slide.id}-hero`,
        type: "retrieved_image",
        provider: "unsplash",
        query: `${brief.title} ${slide.title} ${slide.intent.keyMessage}`,
        targetSlideIds: [slide.id],
      });
      continue;
    }

    assetSpecs.push({
      id: `asset-${slide.id}-hero`,
      type: "generated_image",
      purpose: "hero",
      visualDirection: brief.visualDirection,
      prompt: `${brief.title}. ${slide.title}. ${slide.intent.keyMessage}.`,
      aspectRatio: brief.output.aspectRatio,
      targetSlideIds: [slide.id],
    });
  }

  return { assetSpecs };
}

function resolveAssetAcquisitionMode(input: {
  mode: "generate" | "retrieve" | "auto";
  visualDirection: VisualDirectionSpec;
}): "generate" | "retrieve" {
  if (input.mode === "generate" || input.mode === "retrieve") {
    return input.mode;
  }

  if (input.visualDirection.style === "photorealistic") {
    return "retrieve";
  }

  return "generate";
}

function buildSlidePlans(slideCount: number, brief: PresentationBrief): SlidePlan[] {
  const slides: SlidePlan[] = [];
  const total = Math.max(3, slideCount);

  for (let index = 0; index < total; index += 1) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const ordinal = index + 1;
    const slideId = `slide-${String(ordinal).padStart(3, "0")}`;

    let intent: SlideIntent;
    if (isFirst) {
      intent = {
        type: "title",
        keyMessage: brief.goal.mainMessage,
        audienceTakeaway: "The deck objective and context are clear.",
      };
    } else if (isLast) {
      intent = {
        type: "closing",
        keyMessage: "Decision and next steps",
        audienceTakeaway: brief.goal.desiredOutcome,
      };
    } else if (index % 3 === 0) {
      intent = {
        type: "data_insight",
        keyMessage: "Data indicates a clear direction.",
        audienceTakeaway: "Evidence supports the recommendation.",
      };
    } else if (index % 2 === 0) {
      intent = {
        type: "process",
        keyMessage: "Execution path is concrete and staged.",
        audienceTakeaway: "Implementation is feasible with phased delivery.",
      };
    } else {
      intent = {
        type: "proposal",
        keyMessage: brief.goal.mainMessage,
        audienceTakeaway: brief.goal.desiredOutcome,
      };
    }

    const expectedLayout = toLayout(intent).type;
    const assetPurpose =
      expectedLayout === "hero" ||
      expectedLayout === "comparison" ||
      expectedLayout === "image_left_text_right" ||
      expectedLayout === "text_left_image_right";

    slides.push({
      id: slideId,
      title: buildSlideTitle(intent, brief.title, ordinal, total),
      intent,
      expectedLayout,
      contentRequirements: [
        {
          id: `${slideId}-headline`,
          description: "State one clear message in the title.",
          priority: "high",
          expectedBlockType: "title",
        },
        {
          id: `${slideId}-body`,
          description: "Provide concise supporting detail.",
          priority: "high",
          expectedBlockType: intent.type === "data_insight" ? "table" : "bullet_list",
        },
      ],
      assetRequirements: assetPurpose
        ? [
            {
              id: `${slideId}-visual`,
              purpose: "hero",
              description: "Visual support for the core message.",
              targetSlideIds: [slideId],
            },
          ]
        : undefined,
    });
  }

  return slides;
}

function toSections(slides: SlidePlan[]): DeckSection[] {
  if (slides.length <= 2) {
    return [
      {
        id: "section-main",
        title: "Main Story",
        role: "proposal",
        slides,
      },
    ];
  }

  return [
    {
      id: "section-intro",
      title: "Introduction",
      role: "intro",
      slides: [slides[0]],
    },
    {
      id: "section-body",
      title: "Core Narrative",
      role: "analysis",
      slides: slides.slice(1, -1),
    },
    {
      id: "section-closing",
      title: "Conclusion",
      role: "result",
      slides: [slides[slides.length - 1]],
    },
  ];
}

function flattenSlides(plan: DeckPlan): SlidePlan[] {
  const items: SlidePlan[] = [];
  for (const section of plan.sections) {
    for (const slide of section.slides) {
      items.push(slide);
    }
  }
  return items;
}

function toLayout(intent: SlideIntent): LayoutSpec {
  switch (intent.type) {
    case "title":
      return { type: "title", density: "low", emphasis: "center" };
    case "data_insight":
      return { type: "dashboard", density: "medium", emphasis: "data" };
    case "comparison":
      return { type: "comparison", density: "medium", emphasis: "visual" };
    case "process":
      return { type: "timeline", density: "medium", emphasis: "left" };
    case "closing":
      return { type: "single_column", density: "low", emphasis: "center" };
    default:
      return { type: "single_column", density: "medium", emphasis: "top" };
  }
}

function toContent(slide: SlidePlan, layout: LayoutSpec): ContentBlock[] {
  const titleBlock: ContentBlock = {
    id: `cb-${slide.id}-title`,
    type: "title",
    text: slide.title,
    emphasis: "strong",
  };

  if (layout.type === "dashboard") {
    return [
      titleBlock,
      {
        id: `cb-${slide.id}-table`,
        type: "table",
        caption: "Key metrics",
        headers: ["Metric", "Current", "Target"],
        rows: [
          ["Adoption", "68%", "80%"],
          ["Satisfaction", "4.2/5", "4.5/5"],
        ],
      },
    ];
  }

  if (layout.type === "title") {
    return [
      titleBlock,
      {
        id: `cb-${slide.id}-subtitle`,
        type: "subtitle",
        text: slide.intent.keyMessage,
      },
    ];
  }

  if (slide.intent.type === "closing") {
    return [
      titleBlock,
      {
        id: `cb-${slide.id}-callout`,
        type: "callout",
        text: slide.intent.audienceTakeaway,
        tone: "success",
      },
    ];
  }

  return [
    titleBlock,
    {
      id: `cb-${slide.id}-bullets`,
      type: "bullet_list",
      density: "medium",
      items: [
        { text: slide.intent.keyMessage, importance: "high" },
        { text: "Evidence and context supporting this message.", importance: "medium" },
        { text: slide.intent.audienceTakeaway, importance: "high" },
      ],
    },
  ];
}

function toTitle(userRequest: string): string {
  const compact = userRequest.replaceAll(/\s+/g, " ").trim();
  if (!compact) {
    return "Untitled Presentation";
  }

  if (compact.length <= 64) {
    return compact;
  }

  return `${compact.slice(0, 61)}...`;
}

function parseGoal(seed: string): GoalSpec {
  const text = seed.trim();
  if (!text) {
    return {
      type: "inform",
      mainMessage: "Present the current status clearly.",
      desiredOutcome: "Audience aligns on facts and direction.",
    };
  }

  return {
    type: "proposal",
    mainMessage: text,
    desiredOutcome: "Audience agrees on the proposed plan.",
  };
}

function parseTone(seed?: string): ToneSpec {
  if (seed?.toLowerCase().includes("executive")) {
    return {
      formality: "executive",
      energy: "confident",
      technicalDepth: "medium",
      styleKeywords: ["concise", "decision-oriented"],
    };
  }

  if (seed?.toLowerCase().includes("casual")) {
    return {
      formality: "casual",
      energy: "calm",
      technicalDepth: "low",
      styleKeywords: ["clear", "approachable"],
    };
  }

  return {
    formality: "business",
    energy: "confident",
    technicalDepth: "medium",
    styleKeywords: ["structured", "concise"],
  };
}

function buildSlideTitle(
  intent: SlideIntent,
  deckTitle: string,
  index: number,
  total: number,
): string {
  if (intent.type === "title") {
    return deckTitle;
  }
  if (intent.type === "closing") {
    return "Decision and Next Steps";
  }
  if (intent.type === "data_insight") {
    return `Key Insight ${index}/${total}`;
  }
  if (intent.type === "process") {
    return `Execution Plan ${index}/${total}`;
  }
  return `Proposal Point ${index}/${total}`;
}

function clampSlideCount(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 6;
  }
  return Math.max(3, Math.min(15, Math.round(value)));
}

function shortId(): string {
  return "generated";
}

function slugifyTitle(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  if (!slug) {
    return shortId();
  }

  return slug.slice(0, 40);
}

export function defaultVisualDirection(): VisualDirectionSpec {
  return {
    style: "corporate",
    mood: "trustworthy",
    colorMood: "clean and high contrast",
    composition: "clear hierarchy with whitespace",
    avoid: ["overly decorative backgrounds"],
  };
}
