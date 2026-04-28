export { JsonExporter } from "#/exporters/json/json-exporter.js";
export { HtmlExporter } from "#/exporters/html/html-exporter.js";
export { PdfExporter } from "#/exporters/pdf/pdf-exporter.js";
export { PptxExporter } from "#/exporters/pptx/pptx-exporter.js";
export { inspectPresentation } from "#/inspect/inspect-presentation.js";
export { resolveAnchor } from "#/inspect/resolve-anchor.js";
export type { InspectQuery, InspectResult, ResolvedAnchor } from "#/inspect/types.js";
export { applyOperations } from "#/operations/apply-operations.js";
export type {
  AddChartOperation,
  AddImageOperation,
  AddSlideOperation,
  AddTableOperation,
  AddTextOperation,
  ApplyThemeOperation,
  AttachAssetOperation,
  DeleteElementOperation,
  MoveSlideOperation,
  PresentationOperation,
  RemoveSlideOperation,
  SetSlideLayoutOperation,
  UpdateChartDataOperation,
  UpdateTextOperation,
} from "#/operations/types.js";
export {
  deserializePresentation,
  loadPresentationFromFile,
  savePresentationToFile,
  serializePresentation,
} from "#/json.js";
export { validatePresentation } from "#/validation/validate-presentation.js";
export { autoFixPresentation } from "#/validation/autofix/auto-fix-presentation.js";
export { NoopImageGenerator } from "#/assets/generators/noop-image-generator.js";
export {
  BedrockImageGenerator,
  LocalFileImageGenerator,
  OpenAiImageGenerator,
  generateImageFromAssetSpec,
  retrieveImageFromAssetSpec,
  searchImageCandidates,
  materializeGeneratedAssets,
} from "#/assets/image-runtime.js";
export type {
  GenerateImageFromAssetSpecOptions,
  MaterializeGeneratedAssetsOptions,
  RetrieveImageAssetOptions,
  SearchImageCandidatesOptions,
} from "#/assets/image-runtime.js";
export type { ValidateLevel, ValidateOptions, ValidateResult } from "#/validation/types.js";
export {
  LocalPresentationRuntime,
  createLocalRuntime,
} from "#/runtime/local-presentation-runtime.js";
export {
  PATH_OUTSIDE_WORKSPACE,
  assertPathAllowed,
  resolveSafetyOptions,
} from "#/runtime/path-policy.js";
export {
  createPresentationSpec,
  generateAssetPlan,
  generateDeckPlan,
  generateSlideSpecs,
} from "#/spec-generation/generate-spec-artifacts.js";
export { buildPresentationIr } from "#/builders/build-presentation-ir.js";
export {
  listComponents,
  preflightComponents,
  synthesizeComponents,
} from "#/components/component-catalog.js";
export type {
  BuildPresentationIrInput,
  BuildPresentationIrOutput,
} from "#/builders/build-presentation-ir.js";
export type { ComponentCatalogOptions } from "#/components/component-catalog.js";
export type {
  CreatePresentationSpecInput,
  CreatePresentationSpecOutput,
  GenerateAssetPlanInput,
  GenerateAssetPlanOutput,
  GenerateDeckPlanInput,
  GenerateDeckPlanOutput,
  GenerateSlideSpecsInput,
  GenerateSlideSpecsOutput,
} from "#/spec-generation/types.js";
export type {
  CreatePresentationInput,
  LocalPresentationRuntimeOptions,
  PresentationRuntime,
  PresentationValidator,
} from "#/runtime/types.js";
export type { RuntimeSafetyOptions } from "#/runtime/path-policy.js";

export type Id = string;
export type ISODateTime = string;

export type PresentationBrief = {
  id: Id;
  title: string;
  audience: AudienceSpec;
  goal: GoalSpec;
  context?: string;
  tone: ToneSpec;
  narrative: NarrativeSpec;
  output: OutputSpec;
  constraints: PresentationConstraints;
  visualDirection: VisualDirectionSpec;
  brand?: BrandSpec;
};

export type AudienceSpec = {
  primary: string;
  secondary?: string[];
  expertiseLevel: "beginner" | "intermediate" | "expert" | "executive";
  expectedConcern?: string[];
  expectedQuestions?: string[];
};

export type GoalSpec = {
  type:
    | "inform"
    | "persuade"
    | "proposal"
    | "report"
    | "training"
    | "sales"
    | "research"
    | "decision_support";
  mainMessage: string;
  desiredOutcome: string;
  successCriteria?: string[];
};

export type ToneSpec = {
  formality: "casual" | "business" | "executive" | "academic";
  energy: "calm" | "confident" | "bold" | "inspiring";
  technicalDepth: "low" | "medium" | "high";
  styleKeywords?: string[];
};

export type NarrativeSpec = {
  structure:
    | "problem_solution"
    | "before_after"
    | "proposal"
    | "analysis"
    | "story"
    | "pyramid"
    | "research_paper"
    | "demo";
  arc: NarrativeStep[];
};

export type NarrativeStep = {
  role:
    | "hook"
    | "problem"
    | "insight"
    | "solution"
    | "evidence"
    | "implementation"
    | "impact"
    | "call_to_action";
  message: string;
};

export type OutputSpec = {
  formats: ExportFormat[];
  aspectRatio: "16:9" | "4:3";
  language?: string;
};

export type PresentationConstraints = {
  slideCount?: number;
  maxSlideCount?: number;
  minSlideCount?: number;
  durationMinutes?: number;
  mustInclude?: string[];
  mustAvoid?: string[];
};

export type BrandSpec = {
  name?: string;
  voice?: string;
  colors?: Partial<ColorTokens>;
  fonts?: Partial<TypographyTokens["fontFamily"]>;
  logoAssetId?: Id;
};

export type DeckPlan = {
  id: Id;
  briefId: Id;
  title: string;
  slideCountTarget: number;
  sections: DeckSection[];
  globalStoryline: string;
};

export type DeckSection = {
  id: Id;
  title: string;
  role:
    | "intro"
    | "background"
    | "problem"
    | "proposal"
    | "analysis"
    | "solution"
    | "implementation"
    | "result"
    | "appendix";
  slides: SlidePlan[];
};

export type SlidePlan = {
  id: Id;
  title: string;
  intent: SlideIntent;
  expectedLayout: LayoutIntent;
  contentRequirements: ContentRequirement[];
  assetRequirements?: AssetRequirement[];
};

export type SlideIntent = {
  type:
    | "title"
    | "agenda"
    | "summary"
    | "problem"
    | "comparison"
    | "timeline"
    | "process"
    | "architecture"
    | "data_insight"
    | "case_study"
    | "proposal"
    | "decision"
    | "closing";
  keyMessage: string;
  audienceTakeaway: string;
};

export type LayoutIntent = LayoutSpec["type"];

export type ContentRequirement = {
  id: Id;
  description: string;
  priority: "low" | "medium" | "high";
  expectedBlockType?: ContentBlock["type"];
};

export type AssetRequirement = {
  id: Id;
  purpose: GeneratedImageAssetSpec["purpose"] | "diagram" | "icon" | "screenshot";
  description: string;
  acquisitionMode?: "generate" | "retrieve" | "auto";
  targetSlideIds?: Id[];
};

export type SlideSpec = {
  id: Id;
  slideNumber?: number;
  title: string;
  intent: SlideIntent;
  layout: LayoutSpec;
  content: ContentBlock[];
  speakerNotes?: SpeakerNotesSpec;
  assets?: AssetSpecRef[];
  constraints?: SlideConstraints;
};

export type SpeakerNotesSpec = {
  text: string;
  cues?: string[];
};

export type AssetSpecRef = {
  assetId: Id;
  role: AssetUsage["role"];
};

export type SlideConstraints = {
  maxWords?: number;
  maxBullets?: number;
  requiredElementIds?: Id[];
};

export type ContentBlock =
  | TitleBlock
  | SubtitleBlock
  | ParagraphBlock
  | BulletListBlock
  | TableBlock
  | ChartBlock
  | ImageBlock
  | DiagramBlock
  | MetricBlock
  | CalloutBlock
  | CodeBlock
  | QuoteBlock;

export type TitleBlock = {
  id: Id;
  type: "title";
  text: string;
  emphasis?: "normal" | "strong" | "subtle";
};

export type SubtitleBlock = {
  id: Id;
  type: "subtitle";
  text: string;
};

export type ParagraphBlock = {
  id: Id;
  type: "paragraph";
  text: string;
};

export type BulletListBlock = {
  id: Id;
  type: "bullet_list";
  items: BulletItem[];
  hierarchy?: "flat" | "nested";
  density?: "low" | "medium" | "high";
};

export type BulletItem = {
  text: string;
  children?: BulletItem[];
  importance?: "low" | "medium" | "high";
};

export type TableBlock = {
  id: Id;
  type: "table";
  caption?: string;
  headers: string[];
  rows: string[][];
  emphasis?: TableEmphasis;
};

export type TableEmphasis = {
  rows?: number[];
  columns?: number[];
  cells?: Array<{ row: number; column: number }>;
};

export type ChartBlock = {
  id: Id;
  type: "chart";
  chartType: "bar" | "line" | "area" | "pie" | "scatter" | "combo";
  title?: string;
  data: ChartData;
  encoding: ChartEncoding;
  insight?: string;
};

export type ChartData = {
  series: ChartSeries[];
  categories?: string[];
};

export type ChartSeries = {
  name: string;
  values: number[];
};

export type ChartEncoding = {
  x?: string;
  y?: string;
  color?: string;
  size?: string;
};

export type DiagramBlock = {
  id: Id;
  type: "diagram";
  diagramType:
    | "flowchart"
    | "architecture"
    | "timeline"
    | "layered"
    | "cycle"
    | "matrix"
    | "funnel"
    | "system_map";
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
};

export type DiagramNode = {
  id: Id;
  label: string;
  description?: string;
  kind?: string;
};

export type DiagramEdge = {
  id: Id;
  from: Id;
  to: Id;
  label?: string;
};

export type ImageBlock = {
  id: Id;
  type: "image";
  assetId: Id;
  altText?: string;
  caption?: string;
};

export type MetricBlock = {
  id: Id;
  type: "metric";
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "flat";
};

export type CalloutBlock = {
  id: Id;
  type: "callout";
  text: string;
  tone?: "info" | "success" | "warning" | "danger";
};

export type CodeBlock = {
  id: Id;
  type: "code";
  code: string;
  language?: string;
};

export type QuoteBlock = {
  id: Id;
  type: "quote";
  text: string;
  attribution?: string;
};

export type LayoutSpec = {
  type:
    | "title"
    | "section"
    | "single_column"
    | "two_column"
    | "three_column"
    | "hero"
    | "image_left_text_right"
    | "text_left_image_right"
    | "comparison"
    | "dashboard"
    | "timeline"
    | "matrix"
    | "diagram_focus"
    | "custom";
  density: "low" | "medium" | "high";
  emphasis?: "top" | "left" | "right" | "center" | "visual" | "data";
  regions?: LayoutRegion[];
};

export type LayoutRegion = {
  id: Id;
  role: "title" | "body" | "visual" | "sidebar" | "footer" | "chart" | "table" | "callout";
  contentRefs: Id[];
  priority: number;
};

export type ResolvedLayout = {
  spec: LayoutSpec;
  slideSize: SlideSize;
  regions: ResolvedRegion[];
};

export type SlideSize = {
  width: number;
  height: number;
  unit: "px" | "pt" | "in";
};

export type ResolvedRegion = LayoutRegion & {
  frame: ResolvedFrame;
};

export type ResolvedFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type ThemeSpec = {
  id: Id;
  name: string;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  shadows?: ShadowTokens;
  slideDefaults: SlideStyleDefaults;
  elementDefaults: ElementStyleDefaults;
};

export type ColorTokens = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  accent: string;
  success?: string;
  warning?: string;
  danger?: string;
  chartPalette: string[];
};

export type TypographyTokens = {
  fontFamily: {
    heading: string;
    body: string;
    mono?: string;
  };
  fontSize: {
    title: number;
    heading: number;
    body: number;
    caption: number;
    footnote: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  weight: {
    regular: number;
    medium: number;
    bold: number;
  };
};

export type SpacingTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type RadiusTokens = {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: number;
};

export type ShadowTokens = {
  sm?: string;
  md?: string;
  lg?: string;
};

export type SlideStyleDefaults = {
  backgroundColor?: string;
  padding?: number;
};

export type ElementStyleDefaults = {
  text?: Partial<TextStyle>;
  shape?: Partial<ShapeStyle>;
};

export type ComponentSpec = {
  id: Id;
  version: string;
  capability: string;
  propsSchema: Record<string, unknown>;
  slotSchema: string[];
  layoutContract: {
    variant: string;
    regionRoles: string[];
  };
};

export type ComponentCatalog = {
  version: string;
  components: ComponentSpec[];
};

export type ComponentPreflightResult = {
  catalog: ComponentCatalog;
  matches: Array<{ slideId: Id; componentId: Id }>;
  missing: Array<{
    slideId: Id;
    requiredCapability: string;
    suggestedComponentId: string;
  }>;
};

export type VisualDirectionSpec = {
  style:
    | "minimal"
    | "corporate"
    | "technical"
    | "industrial"
    | "isometric"
    | "flat_vector"
    | "photorealistic"
    | "abstract"
    | "diagrammatic";
  mood: "calm" | "trustworthy" | "futuristic" | "energetic" | "premium" | "practical";
  colorMood?: string;
  composition?: string;
  avoid?: string[];
};

export type AssetSpec =
  | GeneratedImageAssetSpec
  | DiagramAssetSpec
  | IconAssetSpec
  | ExternalImageAssetSpec
  | RetrievedImageAssetSpec
  | ScreenshotAssetSpec;

export type GeneratedImageAssetSpec = {
  id: Id;
  type: "generated_image";
  purpose: "hero" | "background" | "concept" | "illustration" | "thumbnail" | "supporting_visual";
  visualDirection: VisualDirectionSpec;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:2";
  resolution?: {
    width: number;
    height: number;
  };
  targetSlideIds?: Id[];
};

export type DiagramAssetSpec = {
  id: Id;
  type: "diagram";
  diagramType: DiagramBlock["diagramType"];
  description: string;
  targetSlideIds?: Id[];
};

export type IconAssetSpec = {
  id: Id;
  type: "icon";
  name: string;
  style?: VisualDirectionSpec["style"];
  targetSlideIds?: Id[];
};

export type ExternalImageAssetSpec = {
  id: Id;
  type: "external_image";
  uri: string;
  altText?: string;
  provider?: string;
  author?: string;
  license?: string;
  sourcePageUrl?: string;
  attributionRequired?: boolean;
  attributionText?: string;
  query?: string;
  tags?: string[];
  targetSlideIds?: Id[];
};

export type RetrievedImageAssetSpec = {
  id: Id;
  type: "retrieved_image";
  provider:
    | "unsplash"
    | "pexels"
    | "pixabay"
    | "flaticon"
    | "noun_project"
    | "icons8"
    | "undraw"
    | "storyset"
    | "shigureni"
    | "irasutoya"
    | "other";
  query: string;
  selected?: ImageSearchCandidate;
  licenseConstraints?: string[];
  targetSlideIds?: Id[];
};

export type ImageSearchCandidate = {
  id: string;
  provider: string;
  title?: string;
  imageUrl: string;
  sourcePageUrl: string;
  author?: string;
  license: string;
  attributionRequired: boolean;
  attributionText?: string;
  width?: number;
  height?: number;
  tags?: string[];
};

export type ScreenshotAssetSpec = {
  id: Id;
  type: "screenshot";
  sourceUrl?: string;
  description: string;
  targetSlideIds?: Id[];
};

export type AssetRegistry = {
  assets: Asset[];
};

export type Asset = {
  id: Id;
  specId?: Id;
  type: "image" | "diagram" | "icon" | "chart" | "other";
  uri: string;
  mimeType: string;
  metadata: AssetMetadata;
  usage: AssetUsage[];
};

export type AssetMetadata = {
  width?: number;
  height?: number;
  source: "generated" | "uploaded" | "external" | "derived";
  generator?: string;
  prompt?: string;
  provider?: string;
  author?: string;
  license?: string;
  sourcePageUrl?: string;
  attributionRequired?: boolean;
  attributionText?: string;
  createdAt: ISODateTime;
};

export type AssetUsage = {
  slideId: Id;
  elementId: Id;
  role: "background" | "hero" | "inline" | "icon" | "diagram";
};

export type ImageGenerationRequest = {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:2";
  visualDirection?: VisualDirectionSpec;
  outputDir?: string;
  provider?: "openai" | "bedrock" | "local-file";
  model?: string;
  timeoutMs?: number;
  retries?: number;
};

export type GeneratedAsset = Asset;

export interface ImageGenerator {
  name: string;
  generate(input: ImageGenerationRequest): Promise<GeneratedAsset>;
}

export interface ImageRetriever {
  name: string;
  search(input: { query: string; limit?: number }): Promise<ImageSearchCandidate[]>;
  download(input: { candidate: ImageSearchCandidate; outputDir?: string }): Promise<Asset>;
}

export type PresentationIR = {
  id: Id;
  version: string;
  meta: PresentationMeta;
  brief?: PresentationBrief;
  deckPlan?: DeckPlan;
  theme: ThemeSpec;
  slides: SlideIR[];
  assets: AssetRegistry;
  operationLog: OperationRecord[];
  validation?: ValidationReport;
};

export type PresentationMeta = {
  title: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  author?: string;
  source?: string;
};

export type SlideIR = {
  id: Id;
  index: number;
  specId?: Id;
  title?: string;
  intent?: SlideIntent;
  layout: ResolvedLayout;
  elements: ElementIR[];
  speakerNotes?: string;
  comments?: CommentThread[];
  metadata?: Record<string, unknown>;
};

export type CommentThread = {
  id: Id;
  target?: string;
  comments: Comment[];
};

export type Comment = {
  id: Id;
  author: string;
  body: string;
  createdAt: ISODateTime;
};

export type ElementIR =
  | TextElementIR
  | ShapeElementIR
  | ImageElementIR
  | TableElementIR
  | ChartElementIR
  | DiagramElementIR;

export type TextElementIR = {
  id: Id;
  type: "text";
  role: "title" | "subtitle" | "body" | "caption" | "callout" | "footer";
  text: RichText;
  frame: ResolvedFrame;
  style: TextStyle;
};

export type ShapeElementIR = {
  id: Id;
  type: "shape";
  shapeType: "rect" | "round_rect" | "ellipse" | "line" | "arrow";
  frame: ResolvedFrame;
  style: ShapeStyle;
};

export type ImageElementIR = {
  id: Id;
  type: "image";
  assetId: Id;
  role?: "background" | "hero" | "inline" | "icon";
  frame: ResolvedFrame;
  crop?: ImageCrop;
};

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TableElementIR = {
  id: Id;
  type: "table";
  frame: ResolvedFrame;
  headers: string[];
  rows: string[][];
  style?: TableStyle;
};

export type ChartElementIR = {
  id: Id;
  type: "chart";
  frame: ResolvedFrame;
  chartType: ChartBlock["chartType"];
  data: ChartData;
  encoding: ChartEncoding;
  style?: ChartStyle;
};

export type DiagramElementIR = {
  id: Id;
  type: "diagram";
  frame: ResolvedFrame;
  diagramType: DiagramBlock["diagramType"];
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  style?: DiagramStyle;
};

export type RichText = {
  paragraphs: RichParagraph[];
};

export type RichParagraph = {
  runs: RichTextRun[];
  alignment?: "left" | "center" | "right";
  spacingBefore?: number;
  spacingAfter?: number;
};

export type RichTextRun = {
  text: string;
  style?: TextStyle;
  link?: {
    url: string;
  };
};

export type TextStyle = {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  lineHeight?: number;
};

export type ShapeStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
};

export type TableStyle = {
  headerFill?: string;
  borderColor?: string;
  textStyle?: TextStyle;
};

export type ChartStyle = {
  palette?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
};

export type DiagramStyle = {
  nodeFill?: string;
  edgeColor?: string;
  textStyle?: TextStyle;
};

export type OperationRecord = {
  id: Id;
  timestamp: ISODateTime;
  actor: "user" | "agent" | "system";
  operation: unknown;
  beforeHash?: string;
  afterHash?: string;
  result: "success" | "failed";
  error?: string;
};

export type ValidationReport = {
  status: "passed" | "warning" | "failed";
  issues: ValidationIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
};

export type ValidationIssue = {
  id: Id;
  severity: "error" | "warning" | "info";
  category: "structural" | "layout" | "style" | "content" | "asset" | "export";
  message: string;
  target?: string;
  autoFixable?: boolean;
  suggestedFix?: AutoFixAction;
};

export type AutoFixAction = {
  type:
    | "move_element"
    | "resize_element"
    | "reduce_font_size"
    | "split_slide"
    | "shorten_text"
    | "apply_theme_token"
    | "crop_image";
  target: string;
  params: Record<string, unknown>;
};

export interface Exporter {
  format: ExportFormat;
  export(presentation: PresentationIR, options: ExportOptions): Promise<ExportResult>;
}

export type ExportFormat = "pptx" | "html" | "pdf" | "json" | "google_slides";

export type ExportOptions = {
  format: ExportFormat;
  outputPath?: string;
  includeSpeakerNotes?: boolean;
  metadata?: Record<string, unknown>;
};

export type ExportResult = {
  format: ExportFormat;
  path?: string;
  uri?: string;
  data?: Uint8Array | string;
  warnings?: string[];
};
