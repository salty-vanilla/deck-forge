import type { PresentationBrief, PresentationRuntime, SlideSpec } from "@deck-forge/core";
import { autoFixPresentation } from "@deck-forge/core";
import {
  applyPresentationOperationsHandler,
  buildPresentationIrHandler,
  componentPreflightHandler,
  componentSynthesizeHandler,
  createPresentationSpecHandler,
  exportPresentationHandler,
  generateAssetPlanHandler,
  generateDeckPlanHandler,
  generateSlideSpecsHandler,
  inspectPresentationHandler,
  validatePresentationHandler,
} from "@deck-forge/tools";
import { Agent } from "@strands-agents/sdk";
import { createPresentationTools } from "#/tool-adapters.js";

type AgentConstructorConfig = ConstructorParameters<typeof Agent>[0];
type StrandsAgentPassthroughConfig = Omit<AgentConstructorConfig, "tools" | "systemPrompt">;

export type StrandsPresentationAgentOptions = {
  runtime: PresentationRuntime;
  systemPrompt?: string;
  /**
   * Pass-through Agent config except `tools` and `systemPrompt`
   * which are controlled by deck-forge adapter.
   */
  agentConfig?: StrandsAgentPassthroughConfig;
};

export type StrandsRunInput = {
  goal: string;
  mode?: "create" | "modify";
  exportFormat?: "pptx" | "html" | "json" | "pdf";
  validationLevel?: "basic" | "strict" | "export";
  autoFix?: boolean;
  outputPath?: string;
  includeTrace?: boolean;
  acquisitionMode?: "generate" | "retrieve" | "auto";
  presentation?: unknown;
  operations?: unknown[];
  inspectQuery?: unknown;
};

type RunnerStep =
  | "create_spec"
  | "generate_deck_plan"
  | "generate_slide_specs"
  | "component_preflight"
  | "component_synthesize"
  | "generate_asset_plan"
  | "build_ir"
  | "inspect"
  | "apply_operations"
  | "validate"
  | "auto_fix"
  | "revalidate"
  | "export";

type RunnerErrorCategory =
  | "input_error"
  | "pipeline_error"
  | "validation_error"
  | "export_error"
  | "policy_error";

type RunnerError = {
  category: RunnerErrorCategory;
  step: RunnerStep;
  message: string;
};

type RunnerTrace = {
  step: RunnerStep;
  status: "success" | "failed";
  startedAt: string;
  finishedAt: string;
  details?: string;
};

export type StrandsRunResult = {
  finalStatus: "success" | "failed";
  mode: "create" | "modify";
  appliedPolicy: PresentationPolicy;
  artifacts: Record<string, unknown>;
  validationReport?: unknown;
  exportResult?: unknown;
  componentTrace?: {
    missingCount: number;
    createdCount: number;
  };
  errors: RunnerError[];
  trace?: RunnerTrace[];
};

type PresentationPolicy = {
  roleStyle: "senior_consultant";
  narrativeStyle: "decision_oriented";
  designStyle: "refined_minimal";
  visualPreset: "balanced" | "visual_heavy" | "data_heavy";
};

const DEFAULT_SYSTEM_PROMPT = `You are a Presentation Agent powered by deck-forge.
You help users create professional presentations by orchestrating a multi-step pipeline.

Available workflow:
1. presentation_create_spec — Create a presentation brief from user request
2. presentation_generate_deck_plan — Generate deck plan from brief
3. presentation_generate_slide_specs — Generate slide specs from brief + deck plan
4. presentation_generate_asset_plan — Generate asset specs from brief + slide specs
5. presentation_build_ir — Build PresentationIR from all specs
6. presentation_validate — Validate the presentation
7. presentation_export — Export to pptx/html/json
8. presentation_apply_operations — Apply modifications to the presentation
9. presentation_inspect — Inspect presentation contents
10. presentation_generate_image — Generate image assets

When a user asks you to create a presentation, execute steps 1-7 in order.
When a user asks for changes, use: apply_operations -> validate -> export.
Return structured final output with: status, validation summary, export summary, and key artifact ids.`;

export class StrandsPresentationAgent {
  private readonly agent: Agent;

  constructor(private readonly options: StrandsPresentationAgentOptions) {
    const tools = createPresentationTools();
    const { agentConfig } = options;

    this.agent = new Agent({
      ...(agentConfig ?? {}),
      tools,
      systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    });
  }

  async run(input: string | StrandsRunInput) {
    const payload: StrandsRunInput =
      typeof input === "string" ? { goal: input, mode: "create" } : input;
    const mode = payload.mode ?? "create";
    const trace: RunnerTrace[] = [];
    const errors: RunnerError[] = [];
    const includeTrace = payload.includeTrace ?? false;
    const validationLevel = payload.validationLevel ?? "basic";
    const shouldAutoFix = payload.autoFix ?? true;
    const exportFormat = payload.exportFormat ?? "json";
    const appliedPolicy = resolvePresentationPolicy(payload.goal, payload.acquisitionMode);

    try {
      if (mode === "create") {
        const { brief: createdBrief } = await this.runStep("create_spec", trace, async () =>
          createPresentationSpecHandler({ userRequest: payload.goal }),
        );
        const brief = applyPolicyToBrief(createdBrief, appliedPolicy);
        const { deckPlan } = await this.runStep("generate_deck_plan", trace, async () =>
          generateDeckPlanHandler({ brief }),
        );
        const { slideSpecs: generatedSlideSpecs } = await this.runStep(
          "generate_slide_specs",
          trace,
          async () => generateSlideSpecsHandler({ brief, deckPlan }),
        );
        const slideSpecs = applyPolicyToSlideSpecs(generatedSlideSpecs, appliedPolicy);
        const componentPreflight = await this.runStep("component_preflight", trace, async () =>
          componentPreflightHandler({ slideSpecs }),
        );
        const componentSynthesis =
          componentPreflight.result.missing.length > 0
            ? await this.runStep("component_synthesize", trace, async () =>
                componentSynthesizeHandler({ slideSpecs }),
              )
            : { created: [] };
        const { assetSpecs } = await this.runStep("generate_asset_plan", trace, async () =>
          generateAssetPlanHandler({
            brief,
            slideSpecs,
            acquisitionMode: toAcquisitionMode(appliedPolicy.visualPreset),
          }),
        );
        let { presentation } = await this.runStep("build_ir", trace, async () =>
          buildPresentationIrHandler({
            brief,
            deckPlan,
            slideSpecs,
            assetSpecs,
          }),
        );
        let { report } = await this.runStep("validate", trace, async () =>
          validatePresentationHandler({
            presentation,
            level: validationLevel,
          }),
        );

        if (report.status === "failed" && shouldAutoFix) {
          presentation = await this.runStep("auto_fix", trace, async () =>
            autoFixPresentation(presentation, report),
          );
          ({ report } = await this.runStep("revalidate", trace, async () =>
            validatePresentationHandler({
              presentation,
              level: validationLevel,
            }),
          ));
        }

        const { result: exportResult } = await this.runStep("export", trace, async () =>
          exportPresentationHandler({
            presentation,
            format: exportFormat,
            outputPath: payload.outputPath,
          }),
        );

        return {
          finalStatus: "success",
          mode,
          appliedPolicy,
          artifacts: {
            brief,
            deckPlan,
            slideSpecs,
            assetSpecs,
            presentation,
          },
          validationReport: report,
          exportResult,
          componentTrace: {
            missingCount: componentPreflight.result.missing.length,
            createdCount: componentSynthesis.created.length,
          },
          errors,
          trace: includeTrace ? trace : undefined,
        } satisfies StrandsRunResult;
      }

      if (!payload.presentation) {
        throw new Error("MODIFY_INPUT_ERROR: presentation is required for modify mode.");
      }
      if (!Array.isArray(payload.operations)) {
        throw new Error("MODIFY_INPUT_ERROR: operations[] is required for modify mode.");
      }

      await this.runStep("inspect", trace, async () =>
        inspectPresentationHandler({
          presentation: payload.presentation as never,
          query:
            (payload.inspectQuery as never) ??
            ({
              include: ["summary", "slides", "assets"],
            } as never),
        }),
      );

      const { presentation: updatedPresentation } = await this.runStep(
        "apply_operations",
        trace,
        async () =>
          applyPresentationOperationsHandler({
            presentation: payload.presentation as never,
            operations: payload.operations as never,
          }),
      );

      let { report } = await this.runStep("validate", trace, async () =>
        validatePresentationHandler({
          presentation: updatedPresentation,
          level: validationLevel,
        }),
      );

      let presentation = updatedPresentation;
      if (report.status === "failed" && shouldAutoFix) {
        presentation = await this.runStep("auto_fix", trace, async () =>
          autoFixPresentation(updatedPresentation, report),
        );
        ({ report } = await this.runStep("revalidate", trace, async () =>
          validatePresentationHandler({
            presentation,
            level: validationLevel,
          }),
        ));
      }

      const { result: exportResult } = await this.runStep("export", trace, async () =>
        exportPresentationHandler({
          presentation,
          format: exportFormat,
          outputPath: payload.outputPath,
        }),
      );

      return {
        finalStatus: "success",
        mode,
        appliedPolicy,
        artifacts: {
          presentation,
          operations: payload.operations,
        },
        validationReport: report,
        exportResult,
        componentTrace: {
          missingCount: 0,
          createdCount: 0,
        },
        errors,
        trace: includeTrace ? trace : undefined,
      } satisfies StrandsRunResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        category: classifyError(message),
        step: trace[trace.length - 1]?.step ?? "create_spec",
        message,
      });
      return {
        finalStatus: "failed",
        mode,
        appliedPolicy,
        artifacts: {},
        errors,
        trace: includeTrace ? trace : undefined,
      } satisfies StrandsRunResult;
    }
  }

  private async runStep<T>(
    step: RunnerStep,
    trace: RunnerTrace[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    try {
      const value = await fn();
      trace.push({
        step,
        status: "success",
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trace.push({
        step,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        details: message,
      });
      throw error;
    }
  }
}

function resolvePresentationPolicy(
  goal: string,
  acquisitionMode?: "generate" | "retrieve" | "auto",
): PresentationPolicy {
  const inferredVisualPreset = inferVisualPreset(goal);
  const visualPreset =
    acquisitionMode === "retrieve"
      ? "visual_heavy"
      : acquisitionMode === "generate"
        ? "data_heavy"
        : inferredVisualPreset;

  return {
    roleStyle: "senior_consultant",
    narrativeStyle: "decision_oriented",
    designStyle: "refined_minimal",
    visualPreset,
  };
}

function inferVisualPreset(goal: string): "balanced" | "visual_heavy" | "data_heavy" {
  const lower = goal.toLowerCase();
  if (
    lower.includes("dashboard") ||
    lower.includes("kpi") ||
    lower.includes("data") ||
    lower.includes("metric")
  ) {
    return "data_heavy";
  }
  if (
    lower.includes("visual") ||
    lower.includes("design") ||
    lower.includes("brand") ||
    lower.includes("story")
  ) {
    return "visual_heavy";
  }
  return "balanced";
}

function toAcquisitionMode(
  preset: PresentationPolicy["visualPreset"],
): "generate" | "retrieve" | "auto" {
  if (preset === "visual_heavy") {
    return "retrieve";
  }
  if (preset === "data_heavy") {
    return "generate";
  }
  return "auto";
}

function applyPolicyToBrief(
  brief: PresentationBrief,
  policy: PresentationPolicy,
): PresentationBrief {
  const clone = structuredClone(brief);
  const tone = clone.tone;
  tone.formality = "executive";
  tone.energy = "confident";
  tone.technicalDepth = policy.visualPreset === "data_heavy" ? "high" : "medium";
  tone.styleKeywords = ["structured", "concise", "decision-oriented"];
  clone.tone = tone;

  const visualDirection = clone.visualDirection;
  visualDirection.style = policy.visualPreset === "data_heavy" ? "technical" : "corporate";
  visualDirection.mood = "trustworthy";
  visualDirection.composition = "clear hierarchy with whitespace";
  visualDirection.colorMood = "high contrast and clean";
  clone.visualDirection = visualDirection;

  return clone;
}

function applyPolicyToSlideSpecs(slideSpecs: SlideSpec[], policy: PresentationPolicy): SlideSpec[] {
  if (policy.visualPreset === "balanced") {
    return slideSpecs;
  }

  return slideSpecs.map((slide, index) => {
    const next = structuredClone(slide);
    if (policy.visualPreset === "visual_heavy") {
      if (next.layout.type === "single_column" && index > 0) {
        next.layout = { type: "text_left_image_right", density: "low", emphasis: "visual" };
      }
      return next;
    }

    const content = [...next.content];
    const hasChart = content.some((block) => block.type === "chart");
    if (!hasChart) {
      const slideId = next.id;
      content.push({
        id: `cb-${slideId}-chart`,
        type: "chart",
        chartType: "bar",
        title: "Key metric trend",
        data: {
          categories: ["Current", "Target"],
          series: [{ name: "Value", values: [70, 85] }],
        },
        encoding: { x: "category", y: "value" },
      });
      next.content = content;
    }
    return next;
  });
}

function classifyError(message: string): RunnerErrorCategory {
  if (message.includes("PATH_OUTSIDE_WORKSPACE")) {
    return "policy_error";
  }
  if (message.includes("MODIFY_INPUT_ERROR")) {
    return "input_error";
  }
  if (message.toLowerCase().includes("validation")) {
    return "validation_error";
  }
  if (message.toLowerCase().includes("export")) {
    return "export_error";
  }
  return "pipeline_error";
}
