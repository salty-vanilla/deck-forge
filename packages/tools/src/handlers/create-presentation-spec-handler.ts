import { createPresentationSpec } from "@deck-forge/core";

import type { CreatePresentationSpecInputPayload, CreatePresentationSpecOutput } from "#/types.js";

export async function createPresentationSpecHandler(
  input: CreatePresentationSpecInputPayload,
): Promise<CreatePresentationSpecOutput> {
  return createPresentationSpec(input);
}
