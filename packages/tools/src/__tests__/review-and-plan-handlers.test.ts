import { describe, expect, it } from "vitest";

import {
  planPresentationOperationsHandler,
  reviewPresentationHandler,
  setPresentationOperationPlanner,
  setPresentationReviewer,
} from "#/index.js";

describe("review/plan handlers", () => {
  it("throws when reviewer is not configured", async () => {
    setPresentationReviewer(undefined);
    await expect(
      reviewPresentationHandler({
        presentation: {} as never,
      }),
    ).rejects.toThrow("REVIEWER_ERROR");
  });

  it("returns issues and operations from configured adapters", async () => {
    setPresentationReviewer({
      review: async () => [
        {
          code: "layout_overlap",
          severity: "warning",
          message: "elements overlap",
        },
      ],
    });
    setPresentationOperationPlanner({
      plan: async () => [
        {
          type: "update_text",
          slideId: "s1",
          elementId: "t1",
          text: "fixed",
        },
      ],
    });

    const review = await reviewPresentationHandler({
      presentation: {} as never,
    });
    const plan = await planPresentationOperationsHandler({
      presentation: {} as never,
      issues: review.issues,
    });

    expect(review.issues).toHaveLength(1);
    expect(plan.operations).toHaveLength(1);
  });

  it("prefers input adapters over module-level fallback adapters", async () => {
    setPresentationReviewer({
      review: async () => [
        {
          code: "fallback",
          severity: "warning",
          message: "fallback",
        },
      ],
    });
    setPresentationOperationPlanner({
      plan: async () => [],
    });

    const review = await reviewPresentationHandler({
      presentation: {} as never,
      reviewer: {
        review: async () => [
          {
            code: "input",
            severity: "warning",
            message: "input",
          },
        ],
      },
    });
    const plan = await planPresentationOperationsHandler({
      presentation: {} as never,
      issues: review.issues,
      operationPlanner: {
        plan: async () => [
          {
            type: "update_text",
            slideId: "s1",
            elementId: "t1",
            text: "input",
          },
        ],
      },
    });

    expect(review.issues[0]?.code).toBe("input");
    expect(plan.operations).toHaveLength(1);
  });
});
