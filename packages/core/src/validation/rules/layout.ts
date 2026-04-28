import type { PresentationIR, ValidationIssue } from "#/index.js";
import { suggestMoveInBounds } from "#/validation/autofix/auto-fix-presentation.js";
import type { IssueFactory } from "#/validation/types.js";

export function validateLayout(
  presentation: PresentationIR,
  factory: IssueFactory,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const slide of presentation.slides) {
    const size = slide.layout.slideSize;
    const hasTitle = slide.elements.some(
      (element) => element.type === "text" && element.role === "title",
    );

    if (!hasTitle) {
      issues.push(
        factory.issue(
          "warning",
          "layout",
          `Title text element is missing on slide: ${slide.id}`,
          `slide/${slide.id}`,
        ),
      );
    }

    for (const element of slide.elements) {
      const frame = element.frame;

      if (frame.width <= 0 || frame.height <= 0) {
        issues.push(
          factory.issue(
            "error",
            "layout",
            `Element frame has non-positive size: ${element.id}`,
            `element/${element.id}`,
          ),
        );
      }

      if (
        frame.x < 0 ||
        frame.y < 0 ||
        frame.x + frame.width > size.width ||
        frame.y + frame.height > size.height
      ) {
        const clampedX = Math.max(0, frame.x);
        const clampedY = Math.max(0, frame.y);
        const issue = factory.issue(
          "error",
          "layout",
          `Element frame is out of slide bounds: ${element.id}`,
          `element/${element.id}`,
        );
        issue.autoFixable = true;
        issue.suggestedFix = suggestMoveInBounds(element.id, clampedX, clampedY);
        issues.push(issue);
      }

      if (frame.x < 12 || frame.y < 12) {
        issues.push(
          factory.issue(
            "warning",
            "layout",
            `Element margin is very tight: ${element.id}`,
            `element/${element.id}`,
          ),
        );
      }
    }
  }

  return issues;
}
