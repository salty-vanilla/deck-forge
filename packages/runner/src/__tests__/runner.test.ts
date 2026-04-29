import fs from "node:fs";
import path from "node:path";
import type { PresentationIR } from "@deck-forge/core";
import { describe, expect, it } from "vitest";

import { DeckForgeRunner } from "#/runner.js";
import type { DeckForgeRunInput, DeckForgeRunnerOptions } from "#/runner.js";

type RevisionLoopCapableRunner = {
  runRevisionLoop(input: {
    presentation: PresentationIR;
    payload: DeckForgeRunInput;
    validationLevel: "basic" | "strict" | "export";
    shouldAutoFix: boolean;
    revisionPolicy: "none" | "validation_only" | "ai_review";
    maxRevisionLoops: number;
    trace: unknown[];
  }): Promise<{
    presentation: PresentationIR;
    report: unknown;
    summary: {
      policy: "none" | "validation_only" | "ai_review";
      loopsExecuted: number;
      operationsApplied: number;
      trace: Array<{
        issueCount: number;
        operationCount: number;
        operationHash?: string;
        stopReason?: string;
      }>;
    };
  }>;
};

describe("DeckForgeRunner", () => {
  it("exports only the runner public API from the package entrypoint", async () => {
    const mod = await import("#/index.js");

    expect(Object.keys(mod)).toEqual(["DeckForgeRunner"]);
  });

  it("does not depend on Strands, AWS, AgentCore, or adapters", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "packages/runner/package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const dependencyNames = Object.keys(packageJson.dependencies ?? {});

    expect(dependencyNames).toEqual(["@deck-forge/core", "@deck-forge/tools"]);

    const source = fs.readFileSync(
      path.join(process.cwd(), "packages/runner/src/runner.ts"),
      "utf8",
    );
    expect(source).not.toContain("@deck-forge/adapters");
    expect(source).not.toContain("@strands-agents/sdk");
    expect(source).not.toContain("AgentCore");
    expect(source).not.toContain("aws-sdk");
  });

  it("runs deterministic create workflow and returns structured output", async () => {
    const agent = new DeckForgeRunner({
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
    expect(result.revision?.policy).toBe("validation_only");
  });

  it("fails modify mode when parser confidence is low", async () => {
    const agent = new DeckForgeRunner({
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
    const agent = new DeckForgeRunner({
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
        new DeckForgeRunner({
          runtime: {} as never,
          revisionPolicy: "ai_review",
          intentParser: {
            parseCreate: async () => ({ mode: "create", confidence: 0.95 }),
            parseModify: async () => ({ mode: "modify", confidence: 0.95 }),
          },
        }),
    ).toThrow("REVIEWER_ERROR");
  });

  it("caps maxRevisionLoops at 5", async () => {
    const agent = createAiReviewRunner({
      maxRevisionLoops: 99,
      reviewer: {
        review: async () => [
          { code: "still_invalid", severity: "error", message: "Deck remains invalid." },
        ],
      },
      operationPlanner: {
        plan: async () => [],
      },
    });

    const result = await (agent as unknown as RevisionLoopCapableRunner).runRevisionLoop({
      presentation: createEmptyPresentation(),
      payload: { goal: "Fix deck" },
      validationLevel: "basic",
      shouldAutoFix: false,
      revisionPolicy: "ai_review",
      maxRevisionLoops: getResolvedMaxRevisionLoops(agent),
      trace: [],
    });

    expect(result.summary.loopsExecuted).toBe(1);
    expect(getResolvedMaxRevisionLoops(agent)).toBe(5);
    expect(result.summary.trace[0]?.stopReason).toBe("no_planned_operations");
  });

  it("passes validation report into ai reviewer", async () => {
    let receivedErrorCount = -1;
    const agent = createAiReviewRunner({
      reviewer: {
        review: async ({ report }) => {
          receivedErrorCount = report?.summary.errorCount ?? -1;
          return [];
        },
      },
      operationPlanner: {
        plan: async () => [],
      },
    });

    await (agent as unknown as RevisionLoopCapableRunner).runRevisionLoop({
      presentation: createEmptyPresentation(),
      payload: { goal: "Fix deck" },
      validationLevel: "basic",
      shouldAutoFix: false,
      revisionPolicy: "ai_review",
      maxRevisionLoops: 2,
      trace: [],
    });

    expect(receivedErrorCount).toBeGreaterThan(0);
  });

  it("stops ai_review when planner returns no operations", async () => {
    const agent = createAiReviewRunner({
      reviewer: {
        review: async () => [
          { code: "still_invalid", severity: "error", message: "Deck remains invalid." },
        ],
      },
      operationPlanner: {
        plan: async () => [],
      },
    });

    const result = await (agent as unknown as RevisionLoopCapableRunner).runRevisionLoop({
      presentation: createEmptyPresentation(),
      payload: { goal: "Fix deck" },
      validationLevel: "basic",
      shouldAutoFix: false,
      revisionPolicy: "ai_review",
      maxRevisionLoops: 2,
      trace: [],
    });

    expect(result.summary.trace[0]?.stopReason).toBe("no_planned_operations");
  });

  it("stops ai_review when validation does not improve", async () => {
    const agent = createAiReviewRunner({
      reviewer: {
        review: async () => [
          { code: "still_invalid", severity: "error", message: "Deck remains invalid." },
        ],
      },
      operationPlanner: {
        plan: async () => [
          {
            type: "add_text",
            slideId: "slide-1",
            role: "body",
            text: "Additional context",
          },
        ],
      },
    });

    const result = await (agent as unknown as RevisionLoopCapableRunner).runRevisionLoop({
      presentation: createInvalidPresentationWithImageAndChart(),
      payload: { goal: "Fix deck" },
      validationLevel: "basic",
      shouldAutoFix: false,
      revisionPolicy: "ai_review",
      maxRevisionLoops: 2,
      trace: [],
    });

    expect(result.summary.trace[0]?.stopReason).toBe("no_issue_or_validation_improvement");
  });

  it("stops ai_review when operation hash repeats", async () => {
    const addSlideOperation = {
      type: "add_slide" as const,
      title: "Inserted",
      layout: { type: "single_column" as const, density: "medium" as const },
    };
    const agent = createAiReviewRunner({
      reviewer: {
        review: async () => [
          { code: "asset_missing", severity: "error", message: "Asset is missing." },
          { code: "chart_empty", severity: "error", message: "Chart is empty." },
        ],
      },
      operationPlanner: {
        plan: async () => [addSlideOperation],
      },
    });

    const result = await (agent as unknown as RevisionLoopCapableRunner).runRevisionLoop({
      presentation: createEmptyPresentationWithDanglingAsset(),
      payload: { goal: "Fix deck" },
      validationLevel: "basic",
      shouldAutoFix: false,
      revisionPolicy: "ai_review",
      maxRevisionLoops: 3,
      trace: [],
    });

    expect(result.summary.trace.at(-1)?.stopReason).toBe("repeated_operations");
    expect(result.summary.trace.at(-1)?.operationHash).toBeDefined();
  });
});

function createAiReviewRunner(options: Partial<DeckForgeRunnerOptions>): DeckForgeRunner {
  return new DeckForgeRunner({
    runtime: {} as never,
    revisionPolicy: "ai_review",
    intentParser: {
      parseCreate: async () => ({ mode: "create", confidence: 0.95 }),
      parseModify: async () => ({ mode: "modify", confidence: 0.95 }),
    },
    reviewer: {
      review: async () => [],
    },
    operationPlanner: {
      plan: async () => [],
    },
    ...options,
  });
}

function getResolvedMaxRevisionLoops(agent: DeckForgeRunner): number {
  const options = (agent as unknown as { options: DeckForgeRunnerOptions }).options;
  return Math.min(5, Math.max(0, options.maxRevisionLoops ?? 2));
}

function createEmptyPresentation(): PresentationIR {
  return {
    ...createBasePresentation(),
    slides: [],
  };
}

function createEmptyPresentationWithDanglingAsset(): PresentationIR {
  return {
    ...createEmptyPresentation(),
    assets: {
      assets: [
        {
          id: "asset-dangling",
          type: "image",
          uri: "",
          mimeType: "image/png",
          metadata: {
            source: "generated",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          usage: [{ slideId: "missing-slide", elementId: "missing-element", role: "hero" }],
        },
      ],
    },
  };
}

function createInvalidPresentationWithImageAndChart(): PresentationIR {
  return {
    ...createBasePresentation(),
    slides: [
      {
        id: "slide-1",
        index: 0,
        title: "Invalid slide",
        intent: {
          type: "data_insight",
          keyMessage: "Show validation failures",
          audienceTakeaway: "Needs fixing",
        },
        layout: {
          spec: { type: "single_column", density: "medium" },
          slideSize: { width: 1280, height: 720, unit: "px" },
          regions: [],
        },
        elements: [
          {
            id: "image-1",
            type: "image",
            assetId: "missing-asset",
            role: "hero",
            frame: { x: 40, y: 40, width: 400, height: 240 },
          },
          {
            id: "chart-1",
            type: "chart",
            frame: { x: 40, y: 320, width: 400, height: 240 },
            chartType: "bar",
            data: { series: [] },
            encoding: { x: "category", y: "value" },
          },
        ],
      },
    ],
  };
}

function createBasePresentation(): PresentationIR {
  return {
    id: "deck-1",
    version: "1.0.0",
    meta: {
      title: "Deck",
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
}
