import { generateSlideSpecs } from "@deck-forge/core";

import type { GenerateSlideSpecsInput, GenerateSlideSpecsOutput } from "#/types.js";

export async function generateSlideSpecsHandler(
  input: GenerateSlideSpecsInput,
): Promise<GenerateSlideSpecsOutput> {
  return generateSlideSpecs(input);
}
