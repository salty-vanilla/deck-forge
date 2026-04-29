import type {
  AddChartOperation,
  Asset,
  AssetSpec,
  ComponentCatalog,
  ComponentPreflightResult,
  ComponentSpec,
  CreatePresentationSpecInput,
  DeckPlan,
  ExportResult,
  ExternalImageAssetSpec,
  GeneratedImageAssetSpec,
  ImageSearchCandidate,
  InspectQuery,
  InspectResult,
  PresentationBrief,
  PresentationIR,
  PresentationOperation,
  RetrievedImageAssetSpec,
  SlideSpec,
  ThemeSpec,
  ValidationReport,
} from "@deck-forge/core";

export type ApplyPresentationOperationsInput = {
  presentation: PresentationIR;
  operations: PresentationOperation[];
};

export type ApplyPresentationOperationsOutput = {
  presentation: PresentationIR;
};

export type AddChartInput = {
  presentation: PresentationIR;
  operation: AddChartOperation;
};

export type AddChartOutput = {
  presentation: PresentationIR;
};

export type UpdateChartDataInput = {
  presentation: PresentationIR;
  operation: {
    type: "update_chart_data";
    slideId: string;
    elementId: string;
    data: AddChartOperation["data"];
    encoding?: AddChartOperation["encoding"];
    chartType?: AddChartOperation["chartType"];
  };
};

export type UpdateChartDataOutput = {
  presentation: PresentationIR;
};

export type ListComponentsInput = {
  componentsDir?: string;
};

export type ListComponentsOutput = {
  catalog: ComponentCatalog;
};

export type ComponentPreflightInput = {
  slideSpecs: SlideSpec[];
  componentsDir?: string;
};

export type ComponentPreflightOutput = {
  result: ComponentPreflightResult;
};

export type ComponentSynthesizeInput = {
  slideSpecs: SlideSpec[];
  componentsDir?: string;
};

export type ComponentSynthesizeOutput = {
  created: ComponentSpec[];
  catalog: ComponentCatalog;
};

export type InspectPresentationInput = {
  presentation: PresentationIR;
  query: InspectQuery;
};

export type InspectPresentationOutput = {
  result: InspectResult;
};

export type ValidatePresentationInput = {
  presentation: PresentationIR;
  level?: "basic" | "strict" | "export";
};

export type ValidatePresentationOutput = {
  report: ValidationReport;
};

export type ExportPresentationInput = {
  presentation: PresentationIR;
  format: "pptx" | "html" | "json" | "pdf";
  outputPath?: string;
  workspaceRoot?: string;
  allowOutsideWorkspace?: boolean;
};

export type ExportPresentationOutput = {
  result: ExportResult;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type CreatePresentationSpecInputPayload = CreatePresentationSpecInput;

export type CreatePresentationSpecOutput = {
  brief: PresentationBrief;
};

export type GenerateDeckPlanInput = {
  brief: PresentationBrief;
};

export type GenerateDeckPlanOutput = {
  deckPlan: DeckPlan;
};

export type GenerateSlideSpecsInput = {
  brief: PresentationBrief;
  deckPlan: DeckPlan;
};

export type GenerateSlideSpecsOutput = {
  slideSpecs: SlideSpec[];
};

export type GenerateAssetPlanInput = {
  brief: PresentationBrief;
  slideSpecs: SlideSpec[];
  acquisitionMode?: "generate" | "retrieve" | "auto";
};

export type GenerateAssetPlanOutput = {
  assetSpecs: AssetSpec[];
};

export type BuildPresentationIrInput = {
  brief: PresentationBrief;
  deckPlan: DeckPlan;
  slideSpecs: SlideSpec[];
  assetSpecs: AssetSpec[];
  id?: string;
  version?: string;
  title?: string;
  theme?: ThemeSpec;
  meta?: Partial<PresentationIR["meta"]>;
};

export type BuildPresentationIrOutput = {
  presentation: PresentationIR;
};

export type GenerateImageInput = {
  assetSpec: GeneratedImageAssetSpec;
  presentation?: PresentationIR;
  outputDir?: string;
  preferredGenerator?: string;
  provider?: "openai" | "bedrock" | "local-file";
  model?: string;
  timeoutMs?: number;
  retries?: number;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  bedrockRegion?: string;
  bedrockModelId?: string;
  unsplashApiKey?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  workspaceRoot?: string;
  allowOutsideWorkspace?: boolean;
};

export type GenerateImageOutput = {
  asset: Asset;
  presentation?: PresentationIR;
};

export type SearchAssetsInput = {
  query: string;
  provider?: "unsplash" | "pexels" | "pixabay";
  limit?: number;
  unsplashApiKey?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
};

export type SearchAssetsOutput = {
  candidates: ImageSearchCandidate[];
};

export type AttachRetrievedAssetInput = {
  presentation: PresentationIR;
  assetSpec: RetrievedImageAssetSpec | ExternalImageAssetSpec;
  outputDir?: string;
  unsplashApiKey?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  workspaceRoot?: string;
  allowOutsideWorkspace?: boolean;
};

export type AttachRetrievedAssetOutput = {
  asset: Asset;
  presentation: PresentationIR;
};

export type StructuredIntent = {
  mode: "create" | "modify";
  audience?: string;
  goal?: string;
  slideCount?: number;
  tone?: string;
  visualPreset?: "balanced" | "visual_heavy" | "data_heavy";
  constraints?: {
    mustInclude?: string[];
    mustAvoid?: string[];
  };
  modifyIntent?: {
    targetSlideId?: string;
    changeRequest: string;
    operations?: PresentationOperation[];
  };
  confidence: number;
  rationale?: string;
  missingFields?: string[];
};

export interface IntentParser {
  parseCreate(input: { userRequest: string }): Promise<StructuredIntent>;
  parseModify(input: {
    userRequest: string;
    inspectSummary?: Record<string, unknown>;
  }): Promise<StructuredIntent>;
}

export type ParseRequestInput = {
  mode: "create" | "modify";
  userRequest: string;
  inspectSummary?: Record<string, unknown>;
};

export type ParseRequestOutput = {
  intent: StructuredIntent;
};

export type ReviewIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  slideId?: string;
  elementId?: string;
  suggestion?: string;
};

export type ReviewPresentationInput = {
  presentation: PresentationIR;
  report?: ValidationReport;
  goal?: string;
};

export type ReviewPresentationOutput = {
  issues: ReviewIssue[];
};

export interface PresentationReviewer {
  review(input: ReviewPresentationInput): Promise<ReviewIssue[]>;
}

export type PlanPresentationOperationsInput = {
  presentation: PresentationIR;
  issues: ReviewIssue[];
  goal?: string;
};

export type PlanPresentationOperationsOutput = {
  operations: PresentationOperation[];
};

export interface PresentationOperationPlanner {
  plan(input: PlanPresentationOperationsInput): Promise<PresentationOperation[]>;
}
