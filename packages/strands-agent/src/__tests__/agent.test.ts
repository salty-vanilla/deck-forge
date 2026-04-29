import { describe, expect, it } from "vitest";

import { StrandsPresentationAgent } from "#/agent.js";

describe("StrandsPresentationAgent", () => {
  it("runs deterministic create workflow and returns structured output", async () => {
    const agent = new StrandsPresentationAgent({
      runtime: {} as never,
      intentParser: {
        parseCreate: async () => ({
          mode: "create",
          audience: "manufacturing executives",
          goal: "Approve AI modernization plan",
          slideCount: 5,
          tone: "executive",
          confidence: 0.95,
        }),
        parseModify: async () => ({
          mode: "modify",
          confidence: 0.95,
          modifyIntent: { changeRequest: "none", operations: [] },
        }),
      },
    });
    const result = await agent.run({
      goal: "Factory modernization proposal",
      mode: "create",
      includeTrace: true,
      exportFormat: "json",
    });

    expect(result.finalStatus).toBe("success");
    expect(result.mode).toBe("create");
    expect(result.appliedPolicy).toBeDefined();
    expect(result.artifacts.presentation).toBeDefined();
    expect(result.artifacts.structuredIntent).toBeDefined();
    expect(result.validationReport).toBeDefined();
    expect(result.exportResult).toBeDefined();
    expect(result.errors).toHaveLength(0);
    expect(result.trace?.some((item) => item.step === "create_spec")).toBe(true);
    expect(result.trace?.some((item) => item.step === "export")).toBe(true);
  });

  it("fails modify mode when parser confidence is low", async () => {
    const agent = new StrandsPresentationAgent({
      runtime: {} as never,
      intentParser: {
        parseCreate: async () => ({
          mode: "create",
          confidence: 0.95,
        }),
        parseModify: async () => ({
          mode: "modify",
          confidence: 0.5,
          missingFields: ["operations"],
        }),
      },
    });
    const presentation = {
      id: "deck-1",
      version: "1.0.0",
      meta: {
        title: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      theme: {
        id: "theme-1",
        name: "Default",
        colors: {
          background: "#FFFFFF",
          surface: "#F8FAFC",
          textPrimary: "#0F172A",
          textSecondary: "#475569",
          primary: "#1D4ED8",
          secondary: "#0EA5E9",
          accent: "#14B8A6",
          chartPalette: ["#1D4ED8"],
        },
        typography: {
          fontFamily: { heading: "Arial", body: "Arial" },
          fontSize: { title: 36, heading: 28, body: 18, caption: 14, footnote: 12 },
          lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 },
          weight: { regular: 400, medium: 500, bold: 700 },
        },
        spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
        radius: { none: 0, sm: 4, md: 8, lg: 16, full: 9999 },
        slideDefaults: { backgroundColor: "#FFFFFF", padding: 24 },
        elementDefaults: { text: { fontFamily: "Arial", fontSize: 18, color: "#0F172A" } },
      },
      slides: [],
      assets: { assets: [] },
      operationLog: [],
    };
    const result = await agent.run({
      goal: "Update slide 2",
      mode: "modify",
      presentation,
      includeTrace: true,
    });

    expect(result.finalStatus).toBe("failed");
    expect(result.appliedPolicy).toBeDefined();
    expect(result.errors[0]?.category).toBe("nlu_error");
    expect(result.errors[0]?.message).toContain("NLU_PARSE_ERROR");
  });

  it("supports validation_only policy without reviewer/planner", async () => {
    const agent = new StrandsPresentationAgent({
      runtime: {} as never,
      revisionPolicy: "validation_only",
      maxRevisionLoops: 1,
      intentParser: {
        parseCreate: async () => ({
          mode: "create",
          confidence: 0.95,
          audience: "ops",
          goal: "test",
        }),
        parseModify: async () => ({
          mode: "modify",
          confidence: 0.95,
          modifyIntent: { changeRequest: "none", operations: [] },
        }),
      },
    });

    const result = await agent.run({
      goal: "Simple request",
      mode: "create",
      exportFormat: "json",
    });

    expect(result.finalStatus).toBe("success");
    expect(result.revision?.policy).toBe("validation_only");
    expect(Array.isArray(result.revision?.trace)).toBe(true);
  });

  it("fails fast when ai_review policy is configured without reviewer/planner", () => {
    expect(
      () =>
        new StrandsPresentationAgent({
          runtime: {} as never,
          revisionPolicy: "ai_review",
          intentParser: {
            parseCreate: async () => ({ mode: "create", confidence: 0.95 }),
            parseModify: async () => ({ mode: "modify", confidence: 0.95 }),
          },
        }),
    ).toThrow("REVIEWER_ERROR");
  });
});
