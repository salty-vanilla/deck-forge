import { describe, expect, it } from "vitest";

import {
  createPresentationSpec,
  generateAssetPlan,
  generateDeckPlan,
  generateSlideSpecs,
} from "#/index.js";

describe("spec generation", () => {
  it("creates brief from user request", async () => {
    const result = await createPresentationSpec({
      userRequest: "Q4 operating plan for executive review",
      slideCount: 7,
      outputFormat: "pptx",
    });

    expect(result.brief.title).toContain("Q4 operating plan");
    expect(result.brief.constraints.slideCount).toBe(7);
    expect(result.brief.output.formats).toContain("pptx");
  });

  it("generates deck plan and slide specs with intent on all slides", async () => {
    const { brief } = await createPresentationSpec({
      userRequest: "Customer support transformation roadmap",
      slideCount: 5,
    });
    const { deckPlan } = await generateDeckPlan({ brief });
    const { slideSpecs } = await generateSlideSpecs({ brief, deckPlan });

    expect(deckPlan.slideCountTarget).toBe(5);
    expect(slideSpecs).toHaveLength(5);
    for (const slide of slideSpecs) {
      expect(slide.intent.type).toBeDefined();
      expect(slide.intent.keyMessage.length).toBeGreaterThan(0);
    }
  });

  it("generates image assets for visual slide layouts", async () => {
    const { brief } = await createPresentationSpec({
      userRequest: "Product launch deck",
      slideCount: 4,
    });
    const { assetSpecs } = await generateAssetPlan({
      brief,
      slideSpecs: [
        {
          id: "slide-hero",
          title: "Hero",
          intent: {
            type: "proposal",
            keyMessage: "Launch momentum",
            audienceTakeaway: "Brand story is clear",
          },
          layout: { type: "hero", density: "low", emphasis: "visual" },
          content: [
            {
              id: "cb-title",
              type: "title",
              text: "Launch momentum",
            },
          ],
        },
      ],
    });

    expect(assetSpecs).toHaveLength(1);
    expect(assetSpecs[0]?.type).toBe("generated_image");
  });

  it("supports retrieve mode in asset planning", async () => {
    const { brief } = await createPresentationSpec({
      userRequest: "Factory modernization proposal",
      slideCount: 4,
    });
    const { assetSpecs } = await generateAssetPlan({
      brief,
      acquisitionMode: "retrieve",
      slideSpecs: [
        {
          id: "slide-hero",
          title: "Factory hero",
          intent: {
            type: "proposal",
            keyMessage: "New line with automation",
            audienceTakeaway: "Execution image is concrete",
          },
          layout: { type: "hero", density: "low", emphasis: "visual" },
          content: [{ id: "cb-title", type: "title", text: "Factory hero" }],
        },
      ],
    });

    expect(assetSpecs).toHaveLength(1);
    expect(assetSpecs[0]?.type).toBe("retrieved_image");
  });
});
