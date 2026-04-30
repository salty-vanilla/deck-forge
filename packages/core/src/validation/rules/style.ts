import type { PresentationIR, ValidationIssue } from "#src/index.js";
import {
  suggestApplyThemeToken,
  suggestReduceFontSize,
} from "#src/validation/autofix/auto-fix-presentation.js";
import type { IssueFactory } from "#src/validation/types.js";

const MIN_FONT_SIZE = 12;

export function validateStyle(
  presentation: PresentationIR,
  factory: IssueFactory,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const slide of presentation.slides) {
    const background = slide.layout.spec.type
      ? (presentation.theme.slideDefaults.backgroundColor ?? presentation.theme.colors.background)
      : presentation.theme.colors.background;

    for (const element of slide.elements) {
      if (element.type !== "text") {
        continue;
      }

      const fontSize = element.style.fontSize ?? presentation.theme.typography.fontSize.body;
      if (fontSize < MIN_FONT_SIZE) {
        const issue = factory.issue(
          "warning",
          "style",
          `Font size is too small (${fontSize}) in element: ${element.id}`,
          `element/${element.id}`,
        );
        issue.autoFixable = true;
        issue.suggestedFix = suggestReduceFontSize(element.id);
        issues.push(issue);
      }

      if (
        element.style.color &&
        normalizeColor(element.style.color) === normalizeColor(background)
      ) {
        const issue = factory.issue(
          "warning",
          "style",
          `Text color has low contrast against background in element: ${element.id}`,
          `element/${element.id}`,
        );
        issue.autoFixable = true;
        issue.suggestedFix = suggestApplyThemeToken(element.id, "textPrimary");
        issues.push(issue);
      }
    }
  }

  return issues;
}

function normalizeColor(value: string): string {
  return value.replace(/^#/, "").toUpperCase();
}
