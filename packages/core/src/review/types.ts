import type {
  AssetSpec,
  DeckPlan,
  PresentationBrief,
  PresentationIR,
  SlideSpec,
  ValidationReport,
} from "#src/index.js";
import type { InspectResult } from "#src/inspect/types.js";

export type SlideImage = {
  slideId: string;
  mimeType: "image/png" | "image/jpeg";
  data: Uint8Array;
  width?: number;
  height?: number;
  source?: "ir-html" | "pptx" | "external";
  renderer?: string;
};

export type SlideImageRenderInput = {
  presentation: PresentationIR;
  slideIds?: string[];
  format?: "png" | "jpeg";
  scale?: number;
};

export interface SlideImageRenderer {
  render(input: SlideImageRenderInput): Promise<SlideImage[]>;
}

export type ReviewGrounding = {
  language?: string;
  requestedSlideCount?: number;
  mustInclude?: string[];
  mustAvoid?: string[];
};

export type BuildReviewPacketOptions = {
  userRequest: string;
  presentation: PresentationIR;
  brief?: PresentationBrief;
  deckPlan?: DeckPlan;
  slideSpecs?: SlideSpec[];
  assetSpecs?: AssetSpec[];
  validationReport?: ValidationReport;
  grounding?: ReviewGrounding;
  renderer?: SlideImageRenderer;
  renderImages?: boolean;
  slideIds?: string[];
  imageFormat?: "png" | "jpeg";
  imageScale?: number;
};

export type PresentationReviewPacket = {
  userRequest: string;
  brief?: PresentationBrief;
  deckPlan?: DeckPlan;
  slideSpecs?: SlideSpec[];
  assetSpecs?: AssetSpec[];
  presentation: PresentationIR;
  validationReport?: ValidationReport;
  inspect: InspectResult;
  slideImages?: SlideImage[];
  warnings?: string[];
  grounding?: ReviewGrounding;
};

export type SlideImageExportResult = {
  images: SlideImage[];
};
