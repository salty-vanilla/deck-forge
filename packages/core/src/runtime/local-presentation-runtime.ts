import path from "node:path";

import { LocalFileImageGenerator, materializeGeneratedAssets } from "#/assets/image-runtime.js";
import { HtmlExporter } from "#/exporters/html/html-exporter.js";
import { JsonExporter } from "#/exporters/json/json-exporter.js";
import { PdfExporter } from "#/exporters/pdf/pdf-exporter.js";
import { PptxExporter } from "#/exporters/pptx/pptx-exporter.js";
import type { ExportOptions, ExportResult, PresentationIR, ValidationReport } from "#/index.js";
import { inspectPresentation } from "#/inspect/inspect-presentation.js";
import type { InspectQuery, InspectResult } from "#/inspect/types.js";
import { applyOperations } from "#/operations/apply-operations.js";
import type { PresentationOperation } from "#/operations/types.js";
import { assertPathAllowed, resolveSafetyOptions } from "#/runtime/path-policy.js";
import type {
  CreatePresentationInput,
  LocalPresentationRuntimeOptions,
  PresentationRuntime,
  PresentationValidator,
} from "#/runtime/types.js";
import type { ValidateOptions } from "#/validation/types.js";
import { validatePresentation } from "#/validation/validate-presentation.js";

export class LocalPresentationRuntime implements PresentationRuntime {
  private readonly exportersByFormat: Map<
    string,
    LocalPresentationRuntimeOptions["exporters"][number]
  >;

  private readonly validator: PresentationValidator;
  private readonly imageGenerators: NonNullable<LocalPresentationRuntimeOptions["imageGenerators"]>;
  private readonly safety: Required<NonNullable<LocalPresentationRuntimeOptions["safety"]>>;

  public constructor(options: LocalPresentationRuntimeOptions) {
    this.exportersByFormat = new Map(
      options.exporters.map((exporter) => [exporter.format, exporter]),
    );
    this.validator = options.validator ?? validatePresentation;
    this.imageGenerators = options.imageGenerators ?? [new LocalFileImageGenerator()];
    this.safety = resolveSafetyOptions(options.safety);
  }

  public async create(input: CreatePresentationInput): Promise<PresentationIR> {
    const now = new Date().toISOString();

    return {
      id: input.id ?? createPresentationId(),
      version: input.version ?? "1.0.0",
      meta: {
        title: input.title,
        createdAt: input.meta?.createdAt ?? now,
        updatedAt: input.meta?.updatedAt ?? now,
        author: input.meta?.author,
        source: input.meta?.source,
      },
      brief: input.brief,
      deckPlan: input.deckPlan,
      theme: input.theme,
      slides: input.slides ?? [],
      assets: input.assets ?? { assets: [] },
      operationLog: [],
    };
  }

  public async applyOperations(
    presentation: PresentationIR,
    operations: PresentationOperation[],
  ): Promise<PresentationIR> {
    return applyOperations(presentation, operations);
  }

  public async inspect(presentation: PresentationIR, query: InspectQuery): Promise<InspectResult> {
    return inspectPresentation(presentation, query);
  }

  public async validate(
    presentation: PresentationIR,
    options?: ValidateOptions,
  ): Promise<ValidationReport> {
    return this.validator(presentation, options);
  }

  public async export(presentation: PresentationIR, options: ExportOptions): Promise<ExportResult> {
    const exporter = this.exportersByFormat.get(options.format);

    if (!exporter) {
      throw new Error(`No exporter registered for format: ${options.format}`);
    }

    if (options.outputPath) {
      assertPathAllowed(options.outputPath, this.safety, {
        action: "export",
        kind: "file",
      });
    }

    const materialized = await materializeGeneratedAssets(presentation, {
      outputDir: resolveExportOutputDir(options),
      generators: this.imageGenerators,
      fallbackPolicy: "local-file",
      safety: this.safety,
    });

    return exporter.export(materialized, options);
  }
}

function createPresentationId(): string {
  return `deck-${Date.now().toString(36)}`;
}

/**
 * Convenience factory that creates a LocalPresentationRuntime pre-configured
 * with all built-in exporters (JSON, PPTX, HTML, PDF).
 */
export function createLocalRuntime(
  overrides?: Partial<LocalPresentationRuntimeOptions>,
): LocalPresentationRuntime {
  return new LocalPresentationRuntime({
    exporters: [new JsonExporter(), new PptxExporter(), new HtmlExporter(), new PdfExporter()],
    imageGenerators: [new LocalFileImageGenerator()],
    ...overrides,
  });
}

function resolveExportOutputDir(options: ExportOptions): string | undefined {
  if (!options.outputPath) {
    return undefined;
  }
  return path.dirname(path.resolve(options.outputPath));
}
