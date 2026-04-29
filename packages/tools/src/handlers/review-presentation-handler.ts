import type {
  PresentationReviewer,
  ReviewPresentationInput,
  ReviewPresentationOutput,
} from "#/types.js";

let reviewer: PresentationReviewer | undefined;

export function setPresentationReviewer(nextReviewer: PresentationReviewer | undefined): void {
  reviewer = nextReviewer;
}

export function getPresentationReviewer(): PresentationReviewer | undefined {
  return reviewer;
}

export async function reviewPresentationHandler(
  input: ReviewPresentationInput,
): Promise<ReviewPresentationOutput> {
  const currentReviewer = reviewer;
  if (!currentReviewer) {
    throw new Error("REVIEWER_ERROR: PresentationReviewer is not configured.");
  }

  const issues = await currentReviewer.review(input);
  return { issues };
}
