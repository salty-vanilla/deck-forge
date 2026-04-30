import type { SlideSpec } from "@deck-forge/core";
import type {
  CreatePresentationArtifacts,
  StructuredIntent,
  ValidateAgentCreateArtifactsInput,
  ValidateAgentCreateArtifactsOutput,
} from "#src/types.js";

const GENERIC_FILLER_PATTERNS = [
  "Proposal Point",
  "Execution Plan",
  "Key Insight",
  "Evidence and context supporting this message",
  "Data indicates a clear direction",
  "Audience agrees on the proposed plan",
  "Adoption",
  "Satisfaction",
  "68%",
  "80%",
  "4.2/5",
  "4.5/5",
];

export function validateAgentCreateArtifacts(
  input: ValidateAgentCreateArtifactsInput,
): ValidateAgentCreateArtifactsOutput {
  const artifacts = validateCreateArtifacts(input.userRequest, input.intent);
  return { artifacts };
}

function validateCreateArtifacts(
  userRequest: string,
  intent: StructuredIntent,
): CreatePresentationArtifacts {
  const artifacts = intent.createArtifacts;
  if (!artifacts) {
    throw new Error(
      "NLU_PARSE_ERROR: create mode requires IntentParser.createArtifacts with brief, deckPlan, and slideSpecs.",
    );
  }

  const issues: string[] = [];
  if (!artifacts.brief) {
    issues.push("createArtifacts.brief is required");
  }
  if (!artifacts.deckPlan) {
    issues.push("createArtifacts.deckPlan is required");
  }
  if (!Array.isArray(artifacts.slideSpecs) || artifacts.slideSpecs.length === 0) {
    issues.push("createArtifacts.slideSpecs must contain at least one slide");
  }

  const slideSpecs = artifacts.slideSpecs ?? [];
  const requestedSlideCount = intent.grounding?.requestedSlideCount ?? intent.slideCount;
  if (requestedSlideCount !== undefined && slideSpecs.length !== requestedSlideCount) {
    issues.push(
      `slide count mismatch: requested ${requestedSlideCount}, received ${slideSpecs.length}`,
    );
  }

  if (artifacts.deckPlan && slideSpecs.length > 0) {
    const plannedSlideIds = new Set(
      artifacts.deckPlan.sections.flatMap((section) => section.slides.map((slide) => slide.id)),
    );
    for (const slide of slideSpecs) {
      if (!plannedSlideIds.has(slide.id)) {
        issues.push(`slideSpec ${slide.id} is not referenced by deckPlan`);
      }
    }
  }

  const expectedLanguage = intent.grounding?.language ?? detectRequestLanguage(userRequest);
  const actualLanguage = artifacts.brief?.output.language;
  if (expectedLanguage === "ja" && actualLanguage && actualLanguage !== "ja") {
    issues.push(`language mismatch: expected ja, received ${actualLanguage}`);
  }

  const slideText = slideSpecs.map((slide) => slideSpecText(slide)).join("\n");
  const mustInclude = [
    ...(intent.grounding?.mustInclude ?? []),
    ...(intent.constraints?.mustInclude ?? []),
  ].filter(Boolean);
  for (const required of mustInclude) {
    if (!slideText.includes(required)) {
      issues.push(`missing required user-supplied content: ${required}`);
    }
  }

  const mustAvoid = [
    ...(intent.grounding?.mustAvoid ?? []),
    ...(intent.constraints?.mustAvoid ?? []),
    ...GENERIC_FILLER_PATTERNS,
  ].filter(Boolean);
  for (const forbidden of mustAvoid) {
    if (slideText.includes(forbidden)) {
      issues.push(`forbidden or generic filler content found: ${forbidden}`);
    }
  }

  for (const slide of slideSpecs) {
    if (!slide.title.trim()) {
      issues.push(`slide ${slide.id} is missing a title`);
    }
    if (slide.content.length === 0) {
      issues.push(`slide ${slide.id} has no content blocks`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`VALIDATION_ERROR: invalid agent create artifacts: ${issues.join("; ")}`);
  }

  return artifacts;
}

function detectRequestLanguage(text: string): "ja" | "en" {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text) ? "ja" : "en";
}

function slideSpecText(slide: SlideSpec): string {
  return [
    slide.title,
    slide.intent.keyMessage,
    slide.intent.audienceTakeaway,
    ...slide.content.flatMap((block) => contentBlockText(block)),
    slide.speakerNotes?.text ?? "",
  ].join("\n");
}

function contentBlockText(block: SlideSpec["content"][number]): string[] {
  switch (block.type) {
    case "title":
    case "subtitle":
    case "paragraph":
    case "callout":
    case "quote":
      return [block.text];
    case "bullet_list":
      return flattenBulletItems(block.items);
    case "table":
      return [block.caption ?? "", ...block.headers, ...block.rows.flat()];
    case "chart":
      return [
        block.title ?? "",
        block.insight ?? "",
        ...(block.data.categories ?? []),
        ...block.data.series.flatMap((series) => [series.name, ...series.values.map(String)]),
      ];
    case "image":
      return [block.altText ?? "", block.caption ?? ""];
    case "diagram":
      return block.nodes.flatMap((node) => [node.label, node.description ?? ""]);
    case "metric":
      return [block.label, block.value, block.unit ?? ""];
    case "code":
      return [block.code];
    default:
      return [];
  }
}

type TextTreeItem = {
  text: string;
  children?: TextTreeItem[];
};

function flattenBulletItems(items: TextTreeItem[]): string[] {
  const text: string[] = [];
  for (const item of items) {
    text.push(item.text);
    if (item.children) {
      text.push(...flattenBulletItems(item.children));
    }
  }
  return text;
}
