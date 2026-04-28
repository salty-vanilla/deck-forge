import type {
  ExportOptions,
  ExportResult,
  Exporter,
  PresentationIR,
  ValidationReport,
} from "#/index.js";
import type { ImageGenerator } from "#/index.js";
import type { InspectQuery, InspectResult } from "#/inspect/types.js";
import type { PresentationOperation } from "#/operations/types.js";
import type { RuntimeSafetyOptions } from "#/runtime/path-policy.js";
import type { ValidateOptions } from "#/validation/types.js";

export type CreatePresentationInput = {
  id?: string;
  version?: string;
  title: string;
  theme: PresentationIR["theme"];
  brief?: PresentationIR["brief"];
  deckPlan?: PresentationIR["deckPlan"];
  slides?: PresentationIR["slides"];
  assets?: PresentationIR["assets"];
  meta?: Partial<Omit<PresentationIR["meta"], "title">>;
};

export interface PresentationRuntime {
  create(input: CreatePresentationInput): Promise<PresentationIR>;
  applyOperations(
    presentation: PresentationIR,
    operations: PresentationOperation[],
  ): Promise<PresentationIR>;
  inspect(presentation: PresentationIR, query: InspectQuery): Promise<InspectResult>;
  validate(presentation: PresentationIR, options?: ValidateOptions): Promise<ValidationReport>;
  export(presentation: PresentationIR, options: ExportOptions): Promise<ExportResult>;
}

export type PresentationValidator = (
  presentation: PresentationIR,
  options?: ValidateOptions,
) => Promise<ValidationReport>;

export type LocalPresentationRuntimeOptions = {
  exporters: Exporter[];
  imageGenerators?: ImageGenerator[];
  validator?: PresentationValidator;
  safety?: RuntimeSafetyOptions;
  layoutResolver?: unknown;
};
