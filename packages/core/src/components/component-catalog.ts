import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ComponentCatalog,
  ComponentPreflightResult,
  ComponentSpec,
  SlideSpec,
} from "#src/index.js";

const DEFAULT_COMPONENTS_DIR = path.join("templates", "components");

export type ComponentCatalogOptions = {
  componentsDir?: string;
};

export async function listComponents(options?: ComponentCatalogOptions): Promise<ComponentCatalog> {
  const componentsDir = options?.componentsDir ?? DEFAULT_COMPONENTS_DIR;
  await mkdir(componentsDir, { recursive: true });
  const entries = await readdir(componentsDir);
  const specs: ComponentSpec[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const payload = await readFile(path.join(componentsDir, entry), "utf8");
    specs.push(JSON.parse(payload) as ComponentSpec);
  }

  return {
    version: "1.0.0",
    components: specs.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export async function preflightComponents(
  slideSpecs: SlideSpec[],
  options?: ComponentCatalogOptions,
): Promise<ComponentPreflightResult> {
  const catalog = await listComponents(options);
  const existingIds = new Set(catalog.components.map((c) => c.id));
  const missing: Array<{
    slideId: string;
    requiredCapability: string;
    suggestedComponentId: string;
  }> = [];
  const matches: Array<{ slideId: string; componentId: string }> = [];

  for (const slide of slideSpecs) {
    const required = detectCapability(slide);
    const suggestion = suggestComponentId(required);
    if (existingIds.has(suggestion)) {
      matches.push({ slideId: slide.id, componentId: suggestion });
    } else {
      missing.push({
        slideId: slide.id,
        requiredCapability: required,
        suggestedComponentId: suggestion,
      });
    }
  }

  return {
    catalog,
    matches,
    missing,
  };
}

export async function synthesizeComponents(
  slideSpecs: SlideSpec[],
  options?: ComponentCatalogOptions,
): Promise<{ created: ComponentSpec[]; catalog: ComponentCatalog }> {
  const preflight = await preflightComponents(slideSpecs, options);
  const componentsDir = options?.componentsDir ?? DEFAULT_COMPONENTS_DIR;
  await mkdir(componentsDir, { recursive: true });

  const created: ComponentSpec[] = [];
  for (const miss of preflight.missing) {
    const spec = createComponentSpec(miss.suggestedComponentId, miss.requiredCapability);
    await writeFile(
      path.join(componentsDir, `${spec.id}.json`),
      JSON.stringify(spec, null, 2),
      "utf8",
    );
    created.push(spec);
  }

  return {
    created,
    catalog: await listComponents(options),
  };
}

function detectCapability(slide: SlideSpec): string {
  const types = new Set(slide.content.map((block) => block.type));
  if (types.has("chart")) return "chart_focus";
  if (types.has("table")) return "kpi_grid";
  if (types.has("image")) return "hero_visual";
  if (slide.layout.type === "comparison") return "comparison";
  if (slide.layout.type === "timeline") return "timeline";
  return "two_column";
}

function suggestComponentId(capability: string): string {
  switch (capability) {
    case "chart_focus":
      return "chart-focus";
    case "kpi_grid":
      return "kpi-grid";
    case "hero_visual":
      return "hero-visual";
    case "comparison":
      return "comparison";
    case "timeline":
      return "timeline";
    default:
      return "two-column";
  }
}

function createComponentSpec(id: string, capability: string): ComponentSpec {
  return {
    id,
    version: "1.0.0",
    capability,
    propsSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["title"],
    },
    slotSchema: ["title", "body", "visual"],
    layoutContract: {
      variant: capability,
      regionRoles: ["title", "body", "visual"],
    },
  };
}
