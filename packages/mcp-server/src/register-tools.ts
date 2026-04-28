import {
  addChartHandler,
  applyPresentationOperationsHandler,
  attachRetrievedAssetHandler,
  buildPresentationIrHandler,
  componentPreflightHandler,
  componentSynthesizeHandler,
  createPresentationSpecHandler,
  exportPresentationHandler,
  generateAssetPlanHandler,
  generateDeckPlanHandler,
  generateImageHandler,
  generateSlideSpecsHandler,
  inspectPresentationHandler,
  listComponentsHandler,
  searchAssetsHandler,
  updateChartDataHandler,
  validatePresentationHandler,
} from "@deck-forge/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const anyObject = z.object({}).passthrough();

export type ToolRuntimePolicy = {
  workspaceRoot?: string;
  allowOutsideWorkspace?: boolean;
};

export function registerTools(server: McpServer, policy?: ToolRuntimePolicy): void {
  server.registerTool(
    "presentation_create_spec",
    {
      description: "Create a presentation brief from a user request.",
      inputSchema: {
        userRequest: z.string(),
        audience: z.string().optional(),
        goal: z.string().optional(),
        slideCount: z.number().int().positive().optional(),
        tone: z.string().optional(),
        outputFormat: z.enum(["pptx", "pdf", "html", "json"]).optional(),
      },
    },
    async ({ userRequest, audience, goal, slideCount, tone, outputFormat }) => {
      try {
        const output = await createPresentationSpecHandler({
          userRequest,
          audience,
          goal,
          slideCount,
          tone,
          outputFormat,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_generate_deck_plan",
    {
      description: "Generate a deck plan from a presentation brief.",
      inputSchema: {
        brief: anyObject,
      },
    },
    async ({ brief }) => {
      try {
        const output = await generateDeckPlanHandler({
          brief: brief as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_generate_slide_specs",
    {
      description: "Generate slide specs from brief and deck plan.",
      inputSchema: {
        brief: anyObject,
        deckPlan: anyObject,
      },
    },
    async ({ brief, deckPlan }) => {
      try {
        const output = await generateSlideSpecsHandler({
          brief: brief as never,
          deckPlan: deckPlan as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_component_preflight",
    {
      description: "Analyze required slide components against persistent catalog.",
      inputSchema: {
        slideSpecs: z.array(anyObject),
        componentsDir: z.string().optional(),
      },
    },
    async ({ slideSpecs, componentsDir }) => {
      try {
        const output = await componentPreflightHandler({
          slideSpecs: slideSpecs as never,
          componentsDir,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_component_synthesize",
    {
      description: "Synthesize and persist missing slide components.",
      inputSchema: {
        slideSpecs: z.array(anyObject),
        componentsDir: z.string().optional(),
      },
    },
    async ({ slideSpecs, componentsDir }) => {
      try {
        const output = await componentSynthesizeHandler({
          slideSpecs: slideSpecs as never,
          componentsDir,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_component_list",
    {
      description: "List persistent component catalog.",
      inputSchema: {
        componentsDir: z.string().optional(),
      },
    },
    async ({ componentsDir }) => {
      try {
        const output = await listComponentsHandler({ componentsDir });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_generate_asset_plan",
    {
      description: "Generate asset specs from brief and slide specs.",
      inputSchema: {
        brief: anyObject,
        slideSpecs: z.array(anyObject),
        acquisitionMode: z.enum(["generate", "retrieve", "auto"]).optional(),
      },
    },
    async ({ brief, slideSpecs, acquisitionMode }) => {
      try {
        const output = await generateAssetPlanHandler({
          brief: brief as never,
          slideSpecs: slideSpecs as never,
          acquisitionMode,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_build_ir",
    {
      description: "Build PresentationIR from spec artifacts.",
      inputSchema: {
        brief: anyObject,
        deckPlan: anyObject,
        slideSpecs: z.array(anyObject),
        assetSpecs: z.array(anyObject),
        id: z.string().optional(),
        version: z.string().optional(),
        title: z.string().optional(),
        theme: anyObject.optional(),
        meta: anyObject.optional(),
      },
    },
    async ({ brief, deckPlan, slideSpecs, assetSpecs, id, version, title, theme, meta }) => {
      try {
        const output = await buildPresentationIrHandler({
          brief: brief as never,
          deckPlan: deckPlan as never,
          slideSpecs: slideSpecs as never,
          assetSpecs: assetSpecs as never,
          id,
          version,
          title,
          theme: theme as never,
          meta: meta as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_apply_operations",
    {
      description: "Apply operation list to presentation IR and return updated presentation.",
      inputSchema: {
        presentation: anyObject,
        operations: z.array(anyObject),
      },
    },
    async ({ presentation, operations }) => {
      try {
        const output = await applyPresentationOperationsHandler({
          presentation: presentation as never,
          operations: operations as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_add_chart",
    {
      description: "Add chart element to a slide.",
      inputSchema: {
        presentation: anyObject,
        operation: anyObject,
      },
    },
    async ({ presentation, operation }) => {
      try {
        const output = await addChartHandler({
          presentation: presentation as never,
          operation: operation as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_update_chart_data",
    {
      description: "Update chart data of an existing chart element.",
      inputSchema: {
        presentation: anyObject,
        operation: anyObject,
      },
    },
    async ({ presentation, operation }) => {
      try {
        const output = await updateChartDataHandler({
          presentation: presentation as never,
          operation: operation as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_inspect",
    {
      description: "Inspect presentation with include filters and optional anchor target.",
      inputSchema: {
        presentation: anyObject,
        query: anyObject,
      },
    },
    async ({ presentation, query }) => {
      try {
        const output = await inspectPresentationHandler({
          presentation: presentation as never,
          query: query as never,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_validate",
    {
      description: "Validate presentation and return ValidationReport.",
      inputSchema: {
        presentation: anyObject,
        level: z.enum(["basic", "strict", "export"]).optional(),
      },
    },
    async ({ presentation, level }) => {
      try {
        const output = await validatePresentationHandler({
          presentation: presentation as never,
          level,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_export",
    {
      description: "Export presentation to json/pptx/html/pdf.",
      inputSchema: {
        presentation: anyObject,
        format: z.enum(["json", "pptx", "html", "pdf"]),
        outputPath: z.string().optional(),
        workspaceRoot: z.string().optional(),
        allowOutsideWorkspace: z.boolean().optional(),
      },
    },
    async ({ presentation, format, outputPath, workspaceRoot, allowOutsideWorkspace }) => {
      try {
        const output = await exportPresentationHandler({
          presentation: presentation as never,
          format,
          outputPath,
          workspaceRoot: workspaceRoot ?? policy?.workspaceRoot,
          allowOutsideWorkspace: allowOutsideWorkspace ?? policy?.allowOutsideWorkspace,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_generate_image",
    {
      description:
        "Generate an image asset from a GeneratedImageAssetSpec and optionally update presentation assets.",
      inputSchema: {
        assetSpec: anyObject,
        presentation: anyObject.optional(),
        outputDir: z.string().optional(),
        preferredGenerator: z.string().optional(),
        provider: z.enum(["openai", "bedrock", "local-file"]).optional(),
        model: z.string().optional(),
        timeoutMs: z.number().int().positive().optional(),
        retries: z.number().int().min(0).optional(),
        openaiApiKey: z.string().optional(),
        openaiBaseUrl: z.string().optional(),
        bedrockRegion: z.string().optional(),
        bedrockModelId: z.string().optional(),
        unsplashApiKey: z.string().optional(),
        pexelsApiKey: z.string().optional(),
        pixabayApiKey: z.string().optional(),
        workspaceRoot: z.string().optional(),
        allowOutsideWorkspace: z.boolean().optional(),
      },
    },
    async ({
      assetSpec,
      presentation,
      outputDir,
      preferredGenerator,
      provider,
      model,
      timeoutMs,
      retries,
      openaiApiKey,
      openaiBaseUrl,
      bedrockRegion,
      bedrockModelId,
      unsplashApiKey,
      pexelsApiKey,
      pixabayApiKey,
      workspaceRoot,
      allowOutsideWorkspace,
    }) => {
      try {
        const output = await generateImageHandler({
          assetSpec: assetSpec as never,
          presentation: presentation as never,
          outputDir,
          preferredGenerator,
          provider,
          model,
          timeoutMs,
          retries,
          openaiApiKey,
          openaiBaseUrl,
          bedrockRegion,
          bedrockModelId,
          unsplashApiKey,
          pexelsApiKey,
          pixabayApiKey,
          workspaceRoot: workspaceRoot ?? policy?.workspaceRoot,
          allowOutsideWorkspace: allowOutsideWorkspace ?? policy?.allowOutsideWorkspace,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_search_assets",
    {
      description: "Search external providers and return image candidates.",
      inputSchema: {
        query: z.string(),
        provider: z.enum(["unsplash", "pexels", "pixabay"]).optional(),
        limit: z.number().int().positive().optional(),
        unsplashApiKey: z.string().optional(),
        pexelsApiKey: z.string().optional(),
        pixabayApiKey: z.string().optional(),
      },
    },
    async ({ query, provider, limit, unsplashApiKey, pexelsApiKey, pixabayApiKey }) => {
      try {
        const output = await searchAssetsHandler({
          query,
          provider,
          limit,
          unsplashApiKey,
          pexelsApiKey,
          pixabayApiKey,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    "presentation_attach_retrieved_asset",
    {
      description: "Retrieve/attach an external asset and update presentation assets.",
      inputSchema: {
        presentation: anyObject,
        assetSpec: anyObject,
        outputDir: z.string().optional(),
        unsplashApiKey: z.string().optional(),
        pexelsApiKey: z.string().optional(),
        pixabayApiKey: z.string().optional(),
        workspaceRoot: z.string().optional(),
        allowOutsideWorkspace: z.boolean().optional(),
      },
    },
    async ({
      presentation,
      assetSpec,
      outputDir,
      unsplashApiKey,
      pexelsApiKey,
      pixabayApiKey,
      workspaceRoot,
      allowOutsideWorkspace,
    }) => {
      try {
        const output = await attachRetrievedAssetHandler({
          presentation: presentation as never,
          assetSpec: assetSpec as never,
          outputDir,
          unsplashApiKey,
          pexelsApiKey,
          pixabayApiKey,
          workspaceRoot: workspaceRoot ?? policy?.workspaceRoot,
          allowOutsideWorkspace: allowOutsideWorkspace ?? policy?.allowOutsideWorkspace,
        });
        return toToolResult(output);
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}

function toToolResult(payload: Record<string, unknown>): {
  content: [{ type: "text"; text: string }];
  structuredContent: Record<string, unknown>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function toToolError(error: unknown): { isError: true; content: [{ type: "text"; text: string }] } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
