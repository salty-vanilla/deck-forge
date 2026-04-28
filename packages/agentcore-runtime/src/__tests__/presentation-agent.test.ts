import { describe, expect, it } from "vitest";

import { createLocalRuntime } from "@deck-forge/core";

import { PresentationAgent } from "#/presentation-agent.js";

describe("PresentationAgent", () => {
  it("execute() runs full pipeline and returns all artifacts", async () => {
    const runtime = createLocalRuntime();
    const agent = new PresentationAgent({ runtime });

    const result = await agent.execute({
      userRequest: "5-slide deck about AI in manufacturing",
      exportFormat: "json",
      validationLevel: "basic",
    });

    // All pipeline artifacts present
    expect(result.brief).toBeDefined();
    expect(result.brief.title).toBeTruthy();

    expect(result.deckPlan).toBeDefined();
    expect(result.deckPlan.sections.length).toBeGreaterThan(0);

    expect(result.slideSpecs).toBeDefined();
    expect(result.slideSpecs.length).toBeGreaterThan(0);

    expect(result.assetSpecs).toBeDefined();

    expect(result.presentation).toBeDefined();
    expect(result.presentation.slides.length).toBeGreaterThan(0);

    expect(result.validationReport).toBeDefined();
    expect(result.validationReport.issues).toBeDefined();

    expect(result.exportResult).toBeDefined();
    expect(result.finalStatus).toBe("success");
    expect(result.appliedPolicy).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it("execute() defaults to json format and auto-fix enabled", async () => {
    const runtime = createLocalRuntime();
    const agent = new PresentationAgent({ runtime });

    const result = await agent.execute({
      userRequest: "Simple 3-slide overview",
    });

    expect(result.exportResult).toBeDefined();
    expect(result.presentation).toBeDefined();
  });

  it("execute() respects autoFix=false", async () => {
    const runtime = createLocalRuntime();
    const agent = new PresentationAgent({ runtime });

    const result = await agent.execute({
      userRequest: "Quick test deck",
      autoFix: false,
    });

    expect(result.presentation).toBeDefined();
    expect(result.validationReport).toBeDefined();
  });

  it("returns trace when includeTrace=true", async () => {
    const runtime = createLocalRuntime();
    const agent = new PresentationAgent({ runtime });

    const result = await agent.execute({
      userRequest: "Trace test deck",
      includeTrace: true,
    });

    expect(result.trace).toBeDefined();
    expect((result.trace?.length ?? 0) > 0).toBe(true);
    expect(result.trace?.every((record) => record.status === "success")).toBe(true);
  });

  it("classifies workspace policy violation as policy_error", async () => {
    const runtime = createLocalRuntime();
    const agent = new PresentationAgent({
      runtime,
      policy: {
        workspaceRoot: process.cwd(),
        allowOutsideWorkspace: false,
      },
    });

    const result = await agent.execute({
      userRequest: "Policy violation deck",
      exportFormat: "pptx",
      outputPath: "/tmp/deck-forge-agent-policy.pptx",
      includeTrace: true,
    });

    expect(result.finalStatus).toBe("failed");
    expect(result.exportResult).toBeUndefined();
    expect(result.errors.some((error) => error.category === "policy_error")).toBe(true);
    expect(
      result.trace?.some((record) => record.step === "export" && record.status === "failed"),
    ).toBe(true);
  });
});
