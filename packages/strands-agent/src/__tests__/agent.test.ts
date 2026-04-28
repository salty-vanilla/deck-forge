import { describe, expect, it } from "vitest";

import { StrandsPresentationAgent } from "#/agent.js";

describe("StrandsPresentationAgent", () => {
  it("runs deterministic create workflow and returns structured output", async () => {
    const agent = new StrandsPresentationAgent({ runtime: {} as never });
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
    expect(result.validationReport).toBeDefined();
    expect(result.exportResult).toBeDefined();
    expect(result.errors).toHaveLength(0);
    expect(result.trace?.some((item) => item.step === "create_spec")).toBe(true);
    expect(result.trace?.some((item) => item.step === "export")).toBe(true);
  });

  it("fails modify mode without required presentation/operations", async () => {
    const agent = new StrandsPresentationAgent({ runtime: {} as never });
    const result = await agent.run({
      goal: "Update slide 2",
      mode: "modify",
      includeTrace: true,
    });

    expect(result.finalStatus).toBe("failed");
    expect(result.appliedPolicy).toBeDefined();
    expect(result.errors[0]?.category).toBe("input_error");
    expect(result.errors[0]?.message).toContain("MODIFY_INPUT_ERROR");
  });
});
