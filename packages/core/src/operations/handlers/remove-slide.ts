import type { PresentationIR } from "#/index.js";
import type { RemoveSlideOperation } from "#/operations/types.js";
import { findSlide, reindexSlides } from "#/operations/utils.js";

export function removeSlide(presentation: PresentationIR, operation: RemoveSlideOperation): void {
  findSlide(presentation, operation.slideId); // throws if not found

  presentation.slides = presentation.slides.filter((slide) => slide.id !== operation.slideId);
  reindexSlides(presentation);
}
