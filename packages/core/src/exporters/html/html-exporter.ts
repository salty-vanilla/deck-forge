import { writeFile } from "node:fs/promises";

import type {
  ExportOptions,
  ExportResult,
  Exporter,
  ImageElementIR,
  PresentationIR,
  SlideIR,
  TableElementIR,
  TextElementIR,
  ThemeSpec,
} from "#/index.js";

export class HtmlExporter implements Exporter {
  public readonly format = "html";

  public async export(presentation: PresentationIR, options: ExportOptions): Promise<ExportResult> {
    if (options.format !== "html") {
      throw new Error(`HtmlExporter only supports format=html, received: ${options.format}`);
    }

    if (presentation.slides.length === 0) {
      throw new Error("HtmlExporter requires at least one slide.");
    }

    const html = buildHtml(presentation);

    if (options.outputPath) {
      await writeFile(options.outputPath, html, "utf8");
      return { format: "html", path: options.outputPath };
    }

    return { format: "html", data: html };
  }
}

// ---------------------------------------------------------------------------
// HTML generation helpers
// ---------------------------------------------------------------------------

function buildHtml(presentation: PresentationIR): string {
  const { theme } = presentation;
  const slideWidth = presentation.slides[0]?.layout.slideSize.width ?? 1280;
  const slideHeight = presentation.slides[0]?.layout.slideSize.height ?? 720;

  const slidesHtml = presentation.slides
    .map((slide) => buildSlideHtml(slide, presentation, slideWidth, slideHeight))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(presentation.meta.title ?? "Presentation")}</title>
  <style>
${buildGlobalCss(theme, slideWidth, slideHeight)}
  </style>
</head>
<body>
  <div class="deck">
${slidesHtml}
  </div>
</body>
</html>`;
}

function buildGlobalCss(theme: ThemeSpec, slideWidth: number, slideHeight: number): string {
  const t = theme.colors;
  const ty = theme.typography;

  return `    :root {
      --color-background: ${t.background};
      --color-surface: ${t.surface};
      --color-text-primary: ${t.textPrimary};
      --color-text-secondary: ${t.textSecondary};
      --color-primary: ${t.primary};
      --color-secondary: ${t.secondary};
      --color-accent: ${t.accent};
      --font-heading: ${ty.fontFamily.heading};
      --font-body: ${ty.fontFamily.body};
      --font-size-title: ${ty.fontSize.title}px;
      --font-size-heading: ${ty.fontSize.heading}px;
      --font-size-body: ${ty.fontSize.body}px;
      --font-size-caption: ${ty.fontSize.caption}px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #1e1e1e;
      font-family: var(--font-body), sans-serif;
      color: var(--color-text-primary);
    }
    .deck {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 32px;
    }
    .slide {
      position: relative;
      width: ${slideWidth}px;
      height: ${slideHeight}px;
      background: var(--color-background);
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .slide-number {
      position: absolute;
      bottom: 8px;
      right: 16px;
      font-size: 12px;
      color: var(--color-text-secondary);
      opacity: 0.6;
    }
    .element {
      position: absolute;
      overflow: hidden;
    }
    .text-element { white-space: pre-wrap; }
    .text-title { font-family: var(--font-heading), sans-serif; font-size: var(--font-size-title); font-weight: bold; }
    .text-subtitle { font-family: var(--font-heading), sans-serif; font-size: var(--font-size-heading); }
    .text-body { font-size: var(--font-size-body); line-height: 1.6; }
    .text-caption { font-size: var(--font-size-caption); color: var(--color-text-secondary); }
    .text-callout { font-size: var(--font-size-body); font-style: italic; border-left: 4px solid var(--color-accent); padding-left: 12px; }
    .text-footer { font-size: var(--font-size-caption); color: var(--color-text-secondary); }
    .image-element img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .image-background img { object-fit: cover; }
    table.table-element { border-collapse: collapse; width: 100%; height: 100%; font-size: var(--font-size-body); }
    table.table-element th { background: var(--color-primary); color: #fff; padding: 6px 10px; text-align: left; font-weight: bold; }
    table.table-element td { padding: 5px 10px; border: 1px solid rgba(0,0,0,0.1); }
    table.table-element tr:nth-child(even) td { background: rgba(0,0,0,0.04); }`;
}

function buildSlideHtml(
  slide: SlideIR,
  presentation: PresentationIR,
  slideWidth: number,
  slideHeight: number,
): string {
  const elementsHtml = slide.elements
    .map((element) => {
      if (element.type === "text") {
        return buildTextElementHtml(element, slideWidth, slideHeight);
      }
      if (element.type === "image") {
        return buildImageElementHtml(element, presentation, slideWidth, slideHeight);
      }
      if (element.type === "table") {
        return buildTableElementHtml(element, slideWidth, slideHeight);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const bgColor = presentation.theme.slideDefaults.backgroundColor;
  const bgStyle = bgColor ? ` style="background:${bgColor}"` : "";

  return `    <div class="slide" id="slide-${escapeHtml(slide.id)}"${bgStyle}>
${elementsHtml}
      <span class="slide-number">${slide.index + 1}</span>
    </div>`;
}

function buildTextElementHtml(
  element: TextElementIR,
  slideWidth: number,
  slideHeight: number,
): string {
  const pos = frameToPercent(element.frame, slideWidth, slideHeight);
  const paragraphsHtml = element.text.paragraphs
    .map((para) => {
      const text = para.runs.map((run) => escapeHtml(run.text)).join("");
      const align = para.alignment ? ` style="text-align:${para.alignment}"` : "";
      return `<p${align}>${text}</p>`;
    })
    .join("");

  const styleAttr = buildTextInlineStyle(element);

  return `      <div class="element text-element text-${element.role}" style="${pos}${styleAttr}">
        ${paragraphsHtml}
      </div>`;
}

function buildImageElementHtml(
  element: ImageElementIR,
  presentation: PresentationIR,
  slideWidth: number,
  slideHeight: number,
): string {
  const asset = presentation.assets.assets.find((a) => a.id === element.assetId);
  if (!asset || asset.uri.startsWith("placeholder://")) {
    // Render a placeholder box
    const pos = frameToPercent(element.frame, slideWidth, slideHeight);
    return `      <div class="element image-element image-${element.role ?? "inline"}" style="${pos}background:#ccc;display:flex;align-items:center;justify-content:center;">
        <span style="color:#666;font-size:12px">image</span>
      </div>`;
  }

  const pos = frameToPercent(element.frame, slideWidth, slideHeight);
  const src = escapeHtml(asset.uri);
  const alt = escapeHtml(asset.metadata.prompt ?? "slide image");

  return `      <div class="element image-element image-${element.role ?? "inline"}" style="${pos}">
        <img src="${src}" alt="${alt}" loading="lazy" />
      </div>`;
}

function buildTableElementHtml(
  element: TableElementIR,
  slideWidth: number,
  slideHeight: number,
): string {
  const pos = frameToPercent(element.frame, slideWidth, slideHeight);

  const headerRow = element.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyRows = element.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("\n");

  return `      <div class="element" style="${pos}overflow:auto;">
        <table class="table-element">
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function frameToPercent(
  frame: { x: number; y: number; width: number; height: number },
  slideWidth: number,
  slideHeight: number,
): string {
  const x = ((frame.x / slideWidth) * 100).toFixed(4);
  const y = ((frame.y / slideHeight) * 100).toFixed(4);
  const w = ((frame.width / slideWidth) * 100).toFixed(4);
  const h = ((frame.height / slideHeight) * 100).toFixed(4);
  return `left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;
}

function buildTextInlineStyle(element: TextElementIR): string {
  const parts: string[] = [];
  const s = element.style;
  if (s.color) parts.push(`color:${s.color}`);
  if (s.fontSize) parts.push(`font-size:${s.fontSize}px`);
  if (s.fontFamily) parts.push(`font-family:${s.fontFamily}`);
  if (s.bold) parts.push("font-weight:bold");
  if (s.italic) parts.push("font-style:italic");
  if (s.underline) parts.push("text-decoration:underline");
  return parts.length > 0 ? `${parts.join(";")};` : "";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
