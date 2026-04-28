import type { PresentationIR } from "#/index.js";
import type { SetSlideLayoutOperation } from "#/operations/types.js";
import { createResolvedRegions, findSlide } from "#/operations/utils.js";

export function setSlideLayout(
  presentation: PresentationIR,
  operation: SetSlideLayoutOperation,
): void {
  const slide = findSlide(presentation, operation.slideId);

  slide.layout = {
    ...slide.layout,
    spec: operation.layout,
    regions: createResolvedRegions(operation.layout, slide.layout.slideSize),
  };
}
