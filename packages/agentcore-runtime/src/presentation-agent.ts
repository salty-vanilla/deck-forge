import type {
  AssetSpec,
  ContentBlock,
  DeckPlan,
  ExportResult,
  PresentationBrief,
  PresentationIR,
  PresentationRuntime,
  RuntimeSafetyOptions,
  SlideSpec,
  ValidationReport,
} from "@deck-forge/core";
import { autoFixPresentation } from "@deck-forge/core";
import {
  buildPresentationIrHandler,
  componentPreflightHandler,
  componentSynthesizeHandler,
  createPresentationSpecHandler,
  exportPresentationHandler,
  generateAssetPlanHandler,
  generateDeckPlanHandler,
  generateSlideSpecsHandler,
  validatePresentationHandler,
} from "@deck-forge/tools";

export type PresentationAgentOptions = {
  runtime: PresentationRuntime;
  policy?: RuntimeSafetyOptions;
  defaultOutput?: {
    exportFormat?: "pptx" | "html" | "json";
    outputPath?: string;
    outputDir?: string;
  };
};

export type PresentationAgentRequest = {
  userRequest: string;
  exportFormat?: "pptx" | "html" | "json";
  validationLevel?: "basic" | "strict" | "export";
  autoFix?: boolean;
  outputPath?: string;
  outputDir?: string;
  stopOnValidationError?: boolean;
  includeTrace?: boolean;
  visualPreset?: "balanced" | "visual_heavy" | "data_heavy";
};

export type AgentErrorCategory =
  | "input_error"
  | "validation_error"
  | "export_error"
  | "policy_error"
  | "pipeline_error";

export type AgentError = {
  category: AgentErrorCategory;
  message: string;
  step: AgentStep;
};

export type AgentStep =
  | "create_spec"
  | "generate_deck_plan"
  | "generate_slide_specs"
  | "component_preflight"
  | "component_synthesize"
  | "generate_asset_plan"
  | "build_ir"
  | "validate"
  | "auto_fix"
  | "revalidate"
  | "export";

export type AgentTraceRecord = {
  step: AgentStep;
  status: "success" | "failed";
  startedAt: string;
  finishedAt: string;
  details?: string;
};

export type PresentationAgentResult = {
  brief: PresentationBrief;
  deckPlan: DeckPlan;
  slideSpecs: SlideSpec[];
  assetSpecs: AssetSpec[];
  presentation: PresentationIR;
  validationReport: ValidationReport;
  exportResult?: ExportResult;
  finalStatus: "success" | "failed";
  appliedPolicy: PresentationPolicy;
  errors: AgentError[];
  trace?: AgentTraceRecord[];
  artifacts: {
    brief: PresentationBrief;
    deckPlan: DeckPlan;
    slideSpecs: SlideSpec[];
    assetSpecs: AssetSpec[];
    presentation: PresentationIR;
    validationReport: ValidationReport;
    exportResult?: ExportResult;
    appliedPolicy: PresentationPolicy;
    componentTrace?: {
      missingCount: number;
      createdCount: number;
    };
  };
};

export type PresentationPolicy = {
  roleStyle: "senior_consultant";
  narrativeStyle: "decision_oriented";
  designStyle: "refined_minimal";
  visualPreset: "balanced" | "visual_heavy" | "data_heavy";
};

export class PresentationAgent {
  constructor(private readonly options: PresentationAgentOptions) {}

  async execute(request: PresentationAgentRequest): Promise<PresentationAgentResult> {
    const traces: AgentTraceRecord[] = [];
    const errors: AgentError[] = [];

    const shouldAutoFix = request.autoFix ?? true;
    const stopOnValidationError = request.stopOnValidationError ?? false;
    const exportFormat = request.exportFormat ?? this.options.defaultOutput?.exportFormat ?? "json";
    const outputPath = request.outputPath ?? this.options.defaultOutput?.outputPath;

    const policy = this.options.policy;

    const appliedPolicy = resolvePresentationPolicy(request.userRequest, request.visualPreset);

    const briefBase = await this.runStep("create_spec", traces, async () => {
      const { brief } = await createPresentationSpecHandler({ userRequest: request.userRequest });
      return brief;
    });
    const brief = applyPolicyToBrief(briefBase, appliedPolicy);

    const deckPlan = await this.runStep("generate_deck_plan", traces, async () => {
      const { deckPlan } = await generateDeckPlanHandler({ brief });
      return deckPlan;
    });

    const rawSlideSpecs = await this.runStep("generate_slide_specs", traces, async () => {
      const { slideSpecs } = await generateSlideSpecsHandler({ brief, deckPlan });
      return slideSpecs;
    });
    const slideSpecs = applyPolicyToSlideSpecs(rawSlideSpecs, appliedPolicy);
    const componentPreflight = await this.runStep("component_preflight", traces, async () =>
      componentPreflightHandler({ slideSpecs }),
    );
    const componentSynthesis =
      componentPreflight.result.missing.length > 0
        ? await this.runStep("component_synthesize", traces, async () =>
            componentSynthesizeHandler({ slideSpecs }),
          )
        : { created: [] };

    const assetSpecs = await this.runStep("generate_asset_plan", traces, async () => {
      const { assetSpecs } = await generateAssetPlanHandler({
        brief,
        slideSpecs,
        acquisitionMode: toAcquisitionMode(appliedPolicy.visualPreset),
      });
      return assetSpecs;
    });

    let presentation = await this.runStep("build_ir", traces, async () => {
      const { presentation } = await buildPresentationIrHandler({
        brief,
        deckPlan,
        slideSpecs,
        assetSpecs,
      });
      return presentation;
    });

    let validationReport = await this.runStep("validate", traces, async () => {
      const { report } = await validatePresentationHandler({
        presentation,
        level: request.validationLevel ?? "basic",
      });
      return report;
    });

    if (validationReport.status === "failed") {
      if (shouldAutoFix) {
        presentation = await this.runStep("auto_fix", traces, async () =>
          autoFixPresentation(presentation, validationReport),
        );

        validationReport = await this.runStep("revalidate", traces, async () => {
          const { report } = await validatePresentationHandler({
            presentation,
            level: request.validationLevel ?? "basic",
          });
          return report;
        });
      } else if (stopOnValidationError) {
        errors.push({
          category: "validation_error",
          message: `Validation failed with ${validationReport.summary.errorCount} error(s).`,
          step: "validate",
        });

        return this.buildResult({
          brief,
          deckPlan,
          slideSpecs,
          assetSpecs,
          presentation,
          validationReport,
          exportResult: undefined,
          finalStatus: "failed",
          appliedPolicy,
          componentTrace: {
            missingCount: componentPreflight.result.missing.length,
            createdCount: componentSynthesis.created.length,
          },
          errors,
          trace: request.includeTrace ? traces : undefined,
        });
      }
    }

    try {
      const { result: exportResult } = await this.runStep("export", traces, async () =>
        exportPresentationHandler({
          presentation,
          format: exportFormat,
          outputPath,
          workspaceRoot: policy?.workspaceRoot,
          allowOutsideWorkspace: policy?.allowOutsideWorkspace,
        }),
      );

      return this.buildResult({
        brief,
        deckPlan,
        slideSpecs,
        assetSpecs,
        presentation,
        validationReport,
        exportResult,
        finalStatus: "success",
        appliedPolicy,
        componentTrace: {
          missingCount: componentPreflight.result.missing.length,
          createdCount: componentSynthesis.created.length,
        },
        errors,
        trace: request.includeTrace ? traces : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        category: classifyError(message, "export"),
        message,
        step: "export",
      });

      return this.buildResult({
        brief,
        deckPlan,
        slideSpecs,
        assetSpecs,
        presentation,
        validationReport,
        exportResult: undefined,
        finalStatus: "failed",
        appliedPolicy,
        componentTrace: {
          missingCount: componentPreflight.result.missing.length,
          createdCount: componentSynthesis.created.length,
        },
        errors,
        trace: request.includeTrace ? traces : undefined,
      });
    }
  }

  private async runStep<T>(
    step: AgentStep,
    trace: AgentTraceRecord[],
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

  private buildResult(input: {
    brief: PresentationBrief;
    deckPlan: DeckPlan;
    slideSpecs: SlideSpec[];
    assetSpecs: AssetSpec[];
    presentation: PresentationIR;
    validationReport: ValidationReport;
    exportResult: ExportResult | undefined;
    finalStatus: "success" | "failed";
    appliedPolicy: PresentationPolicy;
    componentTrace?: {
      missingCount: number;
      createdCount: number;
    };
    errors: AgentError[];
    trace: AgentTraceRecord[] | undefined;
  }): PresentationAgentResult {
    return {
      brief: input.brief,
      deckPlan: input.deckPlan,
      slideSpecs: input.slideSpecs,
      assetSpecs: input.assetSpecs,
      presentation: input.presentation,
      validationReport: input.validationReport,
      exportResult: input.exportResult,
      finalStatus: input.finalStatus,
      appliedPolicy: input.appliedPolicy,
      errors: input.errors,
      trace: input.trace,
      artifacts: {
        brief: input.brief,
        deckPlan: input.deckPlan,
        slideSpecs: input.slideSpecs,
        assetSpecs: input.assetSpecs,
        presentation: input.presentation,
        validationReport: input.validationReport,
        exportResult: input.exportResult,
        appliedPolicy: input.appliedPolicy,
        componentTrace: input.componentTrace,
      },
    };
  }
}

function resolvePresentationPolicy(
  userRequest: string,
  visualPreset?: "balanced" | "visual_heavy" | "data_heavy",
): PresentationPolicy {
  return {
    roleStyle: "senior_consultant",
    narrativeStyle: "decision_oriented",
    designStyle: "refined_minimal",
    visualPreset: visualPreset ?? inferVisualPreset(userRequest),
  };
}

function inferVisualPreset(userRequest: string): "balanced" | "visual_heavy" | "data_heavy" {
  const lower = userRequest.toLowerCase();
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
  clone.tone.formality = "executive";
  clone.tone.energy = "confident";
  clone.tone.technicalDepth = policy.visualPreset === "data_heavy" ? "high" : "medium";
  clone.tone.styleKeywords = ["structured", "concise", "decision-oriented"];
  clone.narrative.structure = "proposal";
  clone.visualDirection.style = policy.visualPreset === "data_heavy" ? "technical" : "corporate";
  clone.visualDirection.mood = "trustworthy";
  clone.visualDirection.composition = "clear hierarchy with whitespace";
  clone.visualDirection.colorMood = "high contrast and clean";
  clone.constraints = {
    ...clone.constraints,
    mustInclude: [
      ...(clone.constraints.mustInclude ?? []),
      "one message per slide",
      "evidence-backed statements",
    ],
    mustAvoid: [
      ...(clone.constraints.mustAvoid ?? []),
      "vague adjectives without evidence",
      "decorative-only visuals",
    ],
  };
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

    const hasChart = next.content.some((block) => block.type === "chart");
    if (hasChart) {
      return next;
    }
    const tableIndex = next.content.findIndex((block) => block.type === "table");
    if (tableIndex >= 0) {
      const table = next.content[tableIndex];
      if (table?.type === "table") {
        next.content[tableIndex] = tableToChart(table, next.id);
      }
      return next;
    }
    const bulletIndex = next.content.findIndex((block) => block.type === "bullet_list");
    if (bulletIndex >= 0) {
      const bullet = next.content[bulletIndex];
      if (bullet?.type === "bullet_list") {
        next.content.push(bulletToChart(bullet, next.id));
      }
    }
    return next;
  });
}

function tableToChart(
  table: Extract<ContentBlock, { type: "table" }>,
  slideId: string,
): ContentBlock {
  const categories = table.rows.map((row) => row[0] ?? "N/A");
  const values = table.rows.map((row, index) => {
    const raw = row[1] ?? "";
    const parsed = Number(raw.replaceAll(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : index + 1;
  });
  return {
    id: `cb-${slideId}-chart`,
    type: "chart",
    chartType: "bar",
    title: table.caption ?? "Key metrics",
    data: {
      categories,
      series: [{ name: "Value", values }],
    },
    encoding: { x: "category", y: "value" },
    insight: "Metric comparison by category.",
  };
}

function bulletToChart(
  bullet: Extract<ContentBlock, { type: "bullet_list" }>,
  slideId: string,
): ContentBlock {
  return {
    id: `cb-${slideId}-chart`,
    type: "chart",
    chartType: "bar",
    title: "Priority overview",
    data: {
      categories: bullet.items.map((item) => item.text),
      series: [{ name: "Priority", values: bullet.items.map((_item, index) => index + 1) }],
    },
    encoding: { x: "item", y: "priority" },
    insight: "Relative priority across key items.",
  };
}

function classifyError(message: string, step: AgentStep): AgentErrorCategory {
  if (message.includes("PATH_OUTSIDE_WORKSPACE")) {
    return "policy_error";
  }
  if (step === "validate") {
    return "validation_error";
  }
  if (step === "export") {
    return "export_error";
  }
  if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("required")) {
    return "input_error";
  }
  return "pipeline_error";
}
