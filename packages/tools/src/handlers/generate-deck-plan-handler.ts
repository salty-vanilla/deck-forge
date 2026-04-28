import { generateDeckPlan } from "@deck-forge/core";

import type { GenerateDeckPlanInput, GenerateDeckPlanOutput } from "#/types.js";

export async function generateDeckPlanHandler(
  input: GenerateDeckPlanInput,
): Promise<GenerateDeckPlanOutput> {
  return generateDeckPlan(input);
}
