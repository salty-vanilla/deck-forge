import type { PresentationIR } from "#/index.js";
import type { UpdateTextOperation } from "#/operations/types.js";
import { findSlide, toRichText } from "#/operations/utils.js";

export function updateText(presentation: PresentationIR, operation: UpdateTextOperation): void {
  const slide = findSlide(presentation, operation.slideId);
  const element = slide.elements.find((el) => el.id === operation.elementId);

  if (!element) {
    throw new Error(`Element not found: ${operation.elementId} in slide ${operation.slideId}`);
  }

  if (element.type !== "text") {
    throw new Error(`Element ${operation.elementId} is type "${element.type}", expected "text"`);
  }

  element.text = toRichText(operation.text);

  if (operation.style) {
    element.style = { ...element.style, ...operation.style };
  }
}
