import type { PresentationIR, ValidationIssue } from "#/index.js";
import type { IssueFactory } from "#/validation/types.js";

export function validateContent(
  presentation: PresentationIR,
  factory: IssueFactory,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const slide of presentation.slides) {
    const textElements = slide.elements.filter((element) => element.type === "text");

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
      const textLength = element.text.paragraphs
        .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
        .join("\n").length;

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
  }

  return issues;
}
