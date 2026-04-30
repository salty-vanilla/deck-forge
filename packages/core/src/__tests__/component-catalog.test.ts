import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { presentationFixture } from "#src/__tests__/fixtures/presentation.fixture.js";
import { preflightComponents, synthesizeComponents } from "#src/components/component-catalog.js";

describe("component catalog", () => {
  it("synthesizes missing components and reuses on next preflight", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "deck-forge-components-"));
    try {
      const slideSpecs = presentationFixture.slides.map((slide) => ({
        id: slide.id,
        title: slide.title ?? slide.id,
        intent:
          slide.intent ??
          ({
            type: "proposal",
            keyMessage: "message",
            audienceTakeaway: "takeaway",
          } as const),
        layout: slide.layout.spec,
        content: [
          {
            id: `${slide.id}-title`,
            type: "title" as const,
            text: slide.title ?? slide.id,
          },
        ],
      }));

      const first = await preflightComponents(slideSpecs, { componentsDir: dir });
      expect(first.missing.length).toBeGreaterThan(0);

      const synthesized = await synthesizeComponents(slideSpecs, { componentsDir: dir });
      expect(synthesized.created.length).toBeGreaterThan(0);

      const second = await preflightComponents(slideSpecs, { componentsDir: dir });
      expect(second.missing).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
