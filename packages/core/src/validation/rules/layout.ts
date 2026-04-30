import type { PresentationIR, ValidationIssue } from "#src/index.js";
import { suggestMoveInBounds } from "#src/validation/autofix/auto-fix-presentation.js";
import type { IssueFactory } from "#src/validation/types.js";

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

    for (let leftIndex = 0; leftIndex < slide.elements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < slide.elements.length; rightIndex += 1) {
        const left = slide.elements[leftIndex];
        const right = slide.elements[rightIndex];
        if (!left || !right) {
          continue;
        }

        const overlapRatio = frameOverlapRatio(left.frame, right.frame);
        if (overlapRatio > 0.08) {
          issues.push(
            factory.issue(
              "warning",
              "layout",
              `Elements overlap on slide ${slide.id}: ${left.id} and ${right.id}`,
              `slide/${slide.id}`,
            ),
          );
        }
      }
    }
  }

  return issues;
}

function frameOverlapRatio(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const overlapArea = overlapWidth * overlapHeight;
  if (overlapArea === 0) {
    return 0;
  }

  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}
