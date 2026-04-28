import { buildPresentationIr } from "@deck-forge/core";

import type { BuildPresentationIrInput, BuildPresentationIrOutput } from "#/types.js";

export async function buildPresentationIrHandler(
  input: BuildPresentationIrInput,
): Promise<BuildPresentationIrOutput> {
  const presentation = buildPresentationIr(input);
  return { presentation };
}
