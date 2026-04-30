import { access } from "node:fs/promises";
import path from "node:path";

import PptxGenJS from "pptxgenjs";

import type {
  ExportOptions,
  ExportResult,
  Exporter,
  ImageElementIR,
  PresentationIR,
  ResolvedFrame,
  SlideSize,
  TableElementIR,
  TextElementIR,
  ThemeSpec,
} from "#src/index.js";

const DATA_URI_IMAGE = /^data:image\/[a-zA-Z0-9+.-]+;base64,/;

type MinimalPptxSlide = {
  background?: { color: string };
  addText: (
    text: string | Array<{ text: string; options?: Record<string, unknown> }>,
    options: Record<string, unknown>,
  ) => void;
  addImage: (options: Record<string, unknown>) => void;
  addTable: (rows: string[][], options: Record<string, unknown>) => void;
  addNotes?: (notes: string[]) => void;
};

export class PptxExporter implements Exporter {
  public readonly format = "pptx";

  public async export(presentation: PresentationIR, options: ExportOptions): Promise<ExportResult> {
    if (options.format !== "pptx") {
      throw new Error(`PptxExporter only supports format=pptx, received: ${options.format}`);
    }

    if (presentation.slides.length === 0) {
      throw new Error("PptxExporter requires at least one slide.");
    }

    const warnings: string[] = [];
    const PptxConstructor = PptxGenJS as unknown as new () => {
      defineLayout: (layout: { name: string; width: number; height: number }) => void;
      layout: string;
      title?: string;
      author?: string;
      addSlide: () => MinimalPptxSlide;
      writeFile: (options: { fileName: string }) => Promise<string>;
      write: (options: { outputType: "uint8array" }) => Promise<Uint8Array>;
    };
    const pptx = new PptxConstructor();

    const baseSlideSize = presentation.slides[0]?.layout.slideSize;
    if (!baseSlideSize) {
      throw new Error("PptxExporter requires slide.layout.slideSize on the first slide.");
    }

    const layout = toPptxLayout(baseSlideSize);
    pptx.defineLayout({ name: "DECK_FORGE_CUSTOM", width: layout.width, height: layout.height });
    pptx.layout = "DECK_FORGE_CUSTOM";

    if (presentation.meta.title) {
      pptx.title = presentation.meta.title;
    }
    if (presentation.meta.author) {
      pptx.author = presentation.meta.author;
    }

    for (const slideIR of presentation.slides) {
      if (!isSameSlideSize(baseSlideSize, slideIR.layout.slideSize)) {
        warnings.push(
          `Slide ${slideIR.id} has a different slide size. Using first slide size for export.`,
        );
      }

      const slide = pptx.addSlide();
      const backgroundColor = presentation.theme.slideDefaults.backgroundColor;

      if (backgroundColor) {
        slide.background = { color: normalizeHexColor(backgroundColor) };
      }

      for (const element of slideIR.elements) {
        if (element.type === "text") {
          renderTextElement(slide, element, baseSlideSize, presentation.theme);
          continue;
        }

        if (element.type === "image") {
          await renderImageElement(slide, element, baseSlideSize, presentation);
          continue;
        }

        if (element.type === "table") {
          renderTableElement(slide, element, baseSlideSize);
          continue;
        }

        warnings.push(
          `Slide ${slideIR.id} element ${element.id} (${element.type}) is not supported by minimal PptxExporter.`,
        );
      }

      if (options.includeSpeakerNotes && slideIR.speakerNotes) {
        slide.addNotes?.([slideIR.speakerNotes]);
      }
    }

    if (options.outputPath) {
      await pptx.writeFile({ fileName: options.outputPath });
      return {
        format: "pptx",
        path: options.outputPath,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const data = await pptx.write({ outputType: "uint8array" });

    return {
      format: "pptx",
      data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

function renderTextElement(
  slide: MinimalPptxSlide,
  element: TextElementIR,
  slideSize: SlideSize,
  theme: ThemeSpec,
): void {
  const frame = toInchFrame(element.frame, slideSize);
  const textProps = richTextToPptxProps(element);
  const hasBullet = element.text.paragraphs.some((paragraph) => paragraph.bullet);

  const valign: "top" | "middle" | "bottom" =
    element.role === "title" || element.role === "callout"
      ? "middle"
      : element.role === "footer"
        ? "bottom"
        : "top";

  const options: Record<string, unknown> = {
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
    align: element.text.paragraphs[0]?.alignment,
    bold: element.style.bold,
    italic: element.style.italic,
    underline: element.style.underline,
    fontFace: element.style.fontFamily,
    fontSize: element.style.fontSize,
    color: element.style.color ? normalizeHexColor(element.style.color) : undefined,
    valign,
    // Keep text inside the frame instead of letting PowerPoint grow the shape
    // and overlap adjacent regions.
    shrinkText: true,
  };

  if (hasBullet) {
    options.paraSpaceAfter = 6;
  }

  if (element.role === "callout") {
    options.fill = { color: normalizeHexColor(theme.colors.surface) };
    options.line = {
      color: normalizeHexColor(theme.colors.secondary ?? theme.colors.textSecondary),
      width: 0.5,
    };
  }

  slide.addText(textProps, options);
}

function richTextToPptxProps(
  element: TextElementIR,
): Array<{ text: string; options?: Record<string, unknown> }> {
  const props: Array<{ text: string; options?: Record<string, unknown> }> = [];

  element.text.paragraphs.forEach((paragraph, paragraphIndex) => {
    const isLastParagraph = paragraphIndex === element.text.paragraphs.length - 1;
    const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: "" }];

    runs.forEach((run, runIndex) => {
      const isLastRun = runIndex === runs.length - 1;
      const runOptions: Record<string, unknown> = {};

      if (runIndex === 0 && paragraph.bullet) {
        const indentLevel = paragraph.bullet.indentLevel ?? 0;
        runOptions.bullet = indentLevel > 0 ? { indent: indentLevel } : true;
        if (indentLevel > 0) {
          runOptions.indentLevel = indentLevel;
        }
      }

      if (paragraph.alignment && runIndex === 0) {
        runOptions.align = paragraph.alignment;
      }

      if (isLastRun && !isLastParagraph) {
        runOptions.breakLine = true;
      }

      const entry: { text: string; options?: Record<string, unknown> } = {
        text: run.text,
      };
      if (Object.keys(runOptions).length > 0) {
        entry.options = runOptions;
      }
      props.push(entry);
    });
  });

  return props;
}

async function renderImageElement(
  slide: MinimalPptxSlide,
  element: ImageElementIR,
  slideSize: SlideSize,
  presentation: PresentationIR,
): Promise<void> {
  const asset = presentation.assets.assets.find((item) => item.id === element.assetId);

  if (!asset) {
    throw new Error(`Image asset not found: ${element.assetId}`);
  }

  const frame = toInchFrame(element.frame, slideSize);
  const imageSource = await resolveImageSource(asset.uri);

  slide.addImage({
    ...imageSource,
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
    // Preserve aspect ratio: scale the image to fit inside the frame.
    sizing: { type: "contain", w: frame.w, h: frame.h },
  });
}

function renderTableElement(
  slide: MinimalPptxSlide,
  element: TableElementIR,
  slideSize: SlideSize,
): void {
  const frame = toInchFrame(element.frame, slideSize);
  const rows: string[][] = [element.headers, ...element.rows];

  slide.addTable(rows, {
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
    border: { pt: 1, color: normalizeHexColor(element.style?.borderColor ?? "#CBD5E1") },
    fill: element.style?.headerFill
      ? normalizeHexColor(element.style.headerFill)
      : normalizeHexColor("#FFFFFF"),
    fontFace: element.style?.textStyle?.fontFamily,
    fontSize: element.style?.textStyle?.fontSize,
    color: element.style?.textStyle?.color
      ? normalizeHexColor(element.style.textStyle.color)
      : normalizeHexColor("#0F172A"),
  });
}

function toPptxLayout(slideSize: SlideSize): { width: number; height: number } {
  return {
    width: toInches(slideSize.width, slideSize.unit),
    height: toInches(slideSize.height, slideSize.unit),
  };
}

function toInchFrame(
  frame: ResolvedFrame,
  slideSize: SlideSize,
): { x: number; y: number; w: number; h: number } {
  return {
    x: toInches(frame.x, slideSize.unit),
    y: toInches(frame.y, slideSize.unit),
    w: toInches(frame.width, slideSize.unit),
    h: toInches(frame.height, slideSize.unit),
  };
}

function toInches(value: number, unit: SlideSize["unit"]): number {
  if (unit === "in") {
    return value;
  }

  if (unit === "pt") {
    return value / 72;
  }

  return value / 96;
}

function normalizeHexColor(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

function isSameSlideSize(left: SlideSize, right: SlideSize): boolean {
  return left.width === right.width && left.height === right.height && left.unit === right.unit;
}

async function resolveImageSource(uri: string): Promise<{ data: string } | { path: string }> {
  if (DATA_URI_IMAGE.test(uri)) {
    return { data: uri };
  }

  const resolvedPath = path.isAbsolute(uri) ? uri : path.resolve(process.cwd(), uri);
  await access(resolvedPath);

  return { path: resolvedPath };
}
