import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const packageSrcRoots = [
  "packages/core/src",
  "packages/tools/src",
  "packages/cli/src",
  "packages/mcp-server/src",
  "packages/runner/src",
  "packages/adapters/src",
];

export default defineConfig({
  plugins: [
    {
      name: "deck-forge-hash-alias",
      resolveId(source, importer) {
        if (!source.startsWith("#/") || !importer) {
          return null;
        }

        const normalizedImporter = importer.replaceAll(path.sep, "/");
        const packageRoot = packageSrcRoots.find((root) =>
          normalizedImporter.includes(`/${root}/`),
        );
        if (!packageRoot) {
          return null;
        }

        const subPath = source.slice(2);
        const absolutePath = path.resolve(process.cwd(), packageRoot, subPath);

        if (absolutePath.endsWith(".js")) {
          const tsPath = `${absolutePath.slice(0, -3)}.ts`;
          if (fs.existsSync(tsPath)) {
            return tsPath;
          }
        }

        return absolutePath;
      },
    },
  ],
});
