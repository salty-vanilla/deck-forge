import type {
  PresentationBrief,
  PresentationIR,
  PresentationOperation,
  PresentationRuntime,
  SlideSpec,
  ValidationReport,
} from "@deck-forge/core";
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
  planPresentationOperationsHandler,
  reviewPresentationHandler,
  setPresentationOperationPlanner,
  setPresentationReviewer,
  validatePresentationHandler,
} from "@deck-forge/tools";
import type {
  IntentParser,
  PresentationOperationPlanner,
  PresentationReviewer,
  StructuredIntent,
} from "@deck-forge/tools";

export type StrandsPresentationAgentOptions = {
  runtime: PresentationRuntime;
  systemPrompt?: string;
  intentParser?: IntentParser;
  revisionPolicy?: "none" | "validation_only" | "ai_review";
  maxRevisionLoops?: number;
  reviewer?: PresentationReviewer;
  operationPlanner?: PresentationOperationPlanner;
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
  | "parse_request"
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
  | "review"
  | "plan_operations"
  | "revalidate"
  | "export";

type RunnerErrorCategory =
  | "input_error"
  | "nlu_error"
  | "validation_error"
  | "export_error"
  | "review_error"
  | "pipeline_error"
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

type RevisionSummary = {
  policy: "none" | "validation_only" | "ai_review";
  loopsExecuted: number;
  operationsApplied: number;
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
  revision?: RevisionSummary;
  errors: RunnerError[];
  trace?: RunnerTrace[];
};

type PresentationPolicy = {
  roleStyle: "senior_consultant";
  narrativeStyle: "decision_oriented";
  designStyle: "refined_minimal";
  visualPreset: "balanced" | "visual_heavy" | "data_heavy";
};

export class StrandsPresentationAgent {
  constructor(private readonly options: StrandsPresentationAgentOptions) {
    setPresentationReviewer(options.reviewer);
    setPresentationOperationPlanner(options.operationPlanner);
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
    const revisionPolicy = this.options.revisionPolicy ?? "none";
    const maxRevisionLoops = Math.max(0, this.options.maxRevisionLoops ?? 2);
    const appliedPolicy = resolvePresentationPolicy(payload.goal, payload.acquisitionMode);

    try {
      if (mode === "create") {
        const structuredIntent = await this.runStep("parse_request", trace, async () =>
          parseCreateIntent(this.options.intentParser, payload.goal),
        );
        const { brief: createdBrief } = await this.runStep("create_spec", trace, async () =>
          createPresentationSpecHandler({
            userRequest: payload.goal,
            audience: structuredIntent.audience,
            goal: structuredIntent.goal,
            slideCount: structuredIntent.slideCount,
            tone: structuredIntent.tone,
          }),
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

        const revision = await this.runRevisionLoop({
          presentation,
          payload,
          validationLevel,
          shouldAutoFix,
          revisionPolicy,
          maxRevisionLoops,
          trace,
        });
        presentation = revision.presentation;

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
            structuredIntent,
            brief,
            deckPlan,
            slideSpecs,
            assetSpecs,
            presentation,
          },
          validationReport: revision.report,
          exportResult,
          componentTrace: {
            missingCount: componentPreflight.result.missing.length,
            createdCount: componentSynthesis.created.length,
          },
          revision: revision.summary,
          errors,
          trace: includeTrace ? trace : undefined,
        } satisfies StrandsRunResult;
      }

      if (!payload.presentation) {
        throw new Error("MODIFY_INPUT_ERROR: presentation is required for modify mode.");
      }

      const inspectResult = await this.runStep("inspect", trace, async () =>
        inspectPresentationHandler({
          presentation: payload.presentation as never,
          query:
            (payload.inspectQuery as never) ??
            ({
              include: ["summary", "slides", "assets"],
            } as never),
        }),
      );

      const structuredIntent = await this.runStep("parse_request", trace, async () =>
        parseModifyIntent(this.options.intentParser, payload.goal, inspectResult.result as never),
      );

      const operations = payload.operations ?? structuredIntent.modifyIntent?.operations;
      if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error("NLU_PARSE_ERROR: modify intent did not provide operations.");
      }

      const { presentation: updatedPresentation } = await this.runStep(
        "apply_operations",
        trace,
        async () =>
          applyPresentationOperationsHandler({
            presentation: payload.presentation as never,
            operations: operations as never,
          }),
      );

      const revision = await this.runRevisionLoop({
        presentation: updatedPresentation,
        payload,
        validationLevel,
        shouldAutoFix,
        revisionPolicy,
        maxRevisionLoops,
        trace,
      });

      const { result: exportResult } = await this.runStep("export", trace, async () =>
        exportPresentationHandler({
          presentation: revision.presentation,
          format: exportFormat,
          outputPath: payload.outputPath,
        }),
      );

      return {
        finalStatus: "success",
        mode,
        appliedPolicy,
        artifacts: {
          presentation: revision.presentation,
          operations,
          structuredIntent,
        },
        validationReport: revision.report,
        exportResult,
        componentTrace: {
          missingCount: 0,
          createdCount: 0,
        },
        revision: revision.summary,
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

  private async runRevisionLoop(input: {
    presentation: PresentationIR;
    payload: StrandsRunInput;
    validationLevel: "basic" | "strict" | "export";
    shouldAutoFix: boolean;
    revisionPolicy: "none" | "validation_only" | "ai_review";
    maxRevisionLoops: number;
    trace: RunnerTrace[];
  }): Promise<{
    presentation: PresentationIR;
    report: ValidationReport;
    summary: RevisionSummary;
  }> {
    let presentation = input.presentation;
    let operationsApplied = 0;
    let loopsExecuted = 0;

    let { report } = await this.runStep("validate", input.trace, async () =>
      validatePresentationHandler({
        presentation,
        level: input.validationLevel,
      }),
    );

    while (loopsExecuted < input.maxRevisionLoops) {
      if (report.status !== "failed") {
        break;
      }

      loopsExecuted += 1;

      if (input.shouldAutoFix) {
        presentation = await this.runStep("auto_fix", input.trace, async () =>
          autoFixPresentation(presentation, report),
        );
        ({ report } = await this.runStep("revalidate", input.trace, async () =>
          validatePresentationHandler({
            presentation,
            level: input.validationLevel,
          }),
        ));
        if (report.status !== "failed") {
          break;
        }
      }

      if (input.revisionPolicy !== "ai_review") {
        break;
      }

      const reviewOutput = await this.runStep("review", input.trace, async () =>
        reviewPresentationHandler({
          presentation,
          report,
          goal: input.payload.goal,
        }),
      );
      const issues = reviewOutput.issues;
      if (issues.length === 0) {
        break;
      }

      const planOutput = await this.runStep("plan_operations", input.trace, async () =>
        planPresentationOperationsHandler({
          presentation,
          issues,
          goal: input.payload.goal,
        }),
      );
      const operations = planOutput.operations as PresentationOperation[];
      if (operations.length === 0) {
        break;
      }

      ({ presentation } = await this.runStep("apply_operations", input.trace, async () =>
        applyPresentationOperationsHandler({
          presentation,
          operations,
        }),
      ));
      operationsApplied += operations.length;

      ({ report } = await this.runStep("revalidate", input.trace, async () =>
        validatePresentationHandler({
          presentation,
          level: input.validationLevel,
        }),
      ));
    }

    return {
      presentation,
      report,
      summary: {
        policy: input.revisionPolicy,
        loopsExecuted,
        operationsApplied,
      },
    };
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

async function parseCreateIntent(
  parser: IntentParser | undefined,
  userRequest: string,
): Promise<StructuredIntent> {
  if (!parser) {
    throw new Error("NLU_PARSE_ERROR: IntentParser is required for create mode.");
  }
  const intent = await parser.parseCreate({ userRequest });
  assertIntentConfidence(intent);
  return intent;
}

async function parseModifyIntent(
  parser: IntentParser | undefined,
  userRequest: string,
  inspectSummary: Record<string, unknown>,
): Promise<StructuredIntent> {
  if (!parser) {
    throw new Error("NLU_PARSE_ERROR: IntentParser is required for modify mode.");
  }
  const intent = await parser.parseModify({ userRequest, inspectSummary });
  assertIntentConfidence(intent);
  return intent;
}

function assertIntentConfidence(intent: StructuredIntent): void {
  if (intent.confidence < 0.7) {
    throw new Error(
      `NLU_PARSE_ERROR: confidence too low (${intent.confidence}). missing=${(intent.missingFields ?? []).join(",")}`,
    );
  }
  if ((intent.missingFields?.length ?? 0) > 0) {
    throw new Error(`NLU_PARSE_ERROR: missing required fields: ${intent.missingFields?.join(",")}`);
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
  if (message.includes("NLU_PARSE_ERROR")) {
    return "nlu_error";
  }
  if (message.toLowerCase().includes("validation")) {
    return "validation_error";
  }
  if (message.toLowerCase().includes("review")) {
    return "review_error";
  }
  if (message.toLowerCase().includes("export")) {
    return "export_error";
  }
  return "pipeline_error";
}
