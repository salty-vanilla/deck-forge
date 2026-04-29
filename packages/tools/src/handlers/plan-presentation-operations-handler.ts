import type {
  PlanPresentationOperationsInput,
  PlanPresentationOperationsOutput,
  PresentationOperationPlanner,
} from "#/types.js";

let operationPlanner: PresentationOperationPlanner | undefined;

export function setPresentationOperationPlanner(
  nextOperationPlanner: PresentationOperationPlanner | undefined,
): void {
  operationPlanner = nextOperationPlanner;
}

export function getPresentationOperationPlanner(): PresentationOperationPlanner | undefined {
  return operationPlanner;
}

export async function planPresentationOperationsHandler(
  input: PlanPresentationOperationsInput,
): Promise<PlanPresentationOperationsOutput> {
  const currentPlanner = operationPlanner;
  if (!currentPlanner) {
    throw new Error("REVIEWER_ERROR: PresentationOperationPlanner is not configured.");
  }

  const operations = await currentPlanner.plan(input);
  return { operations };
}
