import type { PresentationIR, ValidationIssue } from "#src/index.js";
import type { IssueFactory } from "#src/validation/types.js";

export function validateContent(
  presentation: PresentationIR,
  factory: IssueFactory,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenTitles = new Map<string, string>();

  for (const slide of presentation.slides) {
    const textElements = slide.elements.filter((element) => element.type === "text");
    const normalizedTitle = (slide.title ?? "").trim().toLowerCase();

    if (normalizedTitle) {
      const existingSlideId = seenTitles.get(normalizedTitle);
      if (existingSlideId) {
        issues.push(
          factory.issue(
            "warning",
            "content",
            `Duplicate slide title: ${slide.title}`,
            `slide/${slide.id}`,
          ),
        );
      } else {
        seenTitles.set(normalizedTitle, slide.id);
      }
    }

    if (textElements.length === 0 && slide.elements.length === 0) {
      issues.push(
        factory.issue("error", "content", `Slide has no content: ${slide.id}`, `slide/${slide.id}`),
      );
    } else if (totalTextLength(textElements) < 12 && slide.elements.length <= 1) {
      issues.push(
        factory.issue(
          "warning",
          "content",
          `Slide appears near-empty: ${slide.id}`,
          `slide/${slide.id}`,
        ),
      );
    }

    if (textElements.length > 6) {
      issues.push(
        factory.issue(
          "warning",
          "content",
          `Slide has too many text blocks: ${slide.id}`,
          `slide/${slide.id}`,
        ),
      );
    }

    for (const element of textElements) {
      const textLength = flattenText(element).length;

      if (textLength > 600) {
        issues.push(
          factory.issue(
            "warning",
            "content",
            `Text is too long in element: ${element.id}`,
            `element/${element.id}`,
          ),
        );
      }
    }

    for (const element of slide.elements) {
      if (element.type !== "table") {
        continue;
      }

      const cellCount = element.headers.length * (element.rows.length + 1);
      if (cellCount > 40) {
        issues.push(
          factory.issue(
            "warning",
            "content",
            `Table has too many cells for one slide: ${element.id}`,
            `element/${element.id}`,
          ),
        );
      }
    }
  }

  return issues;
}

type TextElement = Extract<PresentationIR["slides"][number]["elements"][number], { type: "text" }>;

function totalTextLength(textElements: TextElement[]): number {
  return textElements.reduce((sum, element) => sum + flattenText(element).trim().length, 0);
}

function flattenText(element: TextElement): string {
  return element.text.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n");
}
