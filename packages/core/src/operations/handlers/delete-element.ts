import type { PresentationIR } from "#/index.js";
import type { DeleteElementOperation } from "#/operations/types.js";
import { findSlide } from "#/operations/utils.js";

export function deleteElement(
  presentation: PresentationIR,
  operation: DeleteElementOperation,
): void {
  const slide = findSlide(presentation, operation.slideId);
  const exists = slide.elements.some((el) => el.id === operation.elementId);

  if (!exists) {
    throw new Error(`Element not found: ${operation.elementId} in slide ${operation.slideId}`);
  }

  slide.elements = slide.elements.filter((el) => el.id !== operation.elementId);
}
