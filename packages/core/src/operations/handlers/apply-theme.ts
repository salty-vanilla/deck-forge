import type { PresentationIR } from "#/index.js";
import type { ApplyThemeOperation } from "#/operations/types.js";

export function applyTheme(presentation: PresentationIR, operation: ApplyThemeOperation): void {
  presentation.theme = operation.theme;
}
