import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { detailContent } from "../../content/details.ts";
import { forestItems } from "../../content/forest.ts";
import { gardenItems } from "../../content/garden.ts";
import { lakeItems } from "../../content/lake.ts";
import { ruinsItems } from "../../content/ruins.ts";

export type V1ExtractManifest = {
  schemaVersion: 1;
  source: "v1-static-typescript";
  garden: typeof gardenItems;
  forest: typeof forestItems;
  lake: typeof lakeItems;
  ruins: typeof ruinsItems;
  details: typeof detailContent;
};

/** Imports executable TypeScript modules; it never parses their source text. */
export function extractV1Content(): V1ExtractManifest {
  return structuredClone({
    schemaVersion: 1 as const,
    source: "v1-static-typescript" as const,
    garden: gardenItems,
    forest: forestItems,
    lake: lakeItems,
    ruins: ruinsItems,
    details: detailContent,
  });
}

export function serializeV1Extract(manifest: V1ExtractManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === import.meta.url);
}

if (isDirectRun()) {
  const output = serializeV1Extract(extractV1Content());
  const outputPath = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--output="))
    ?.slice("--output=".length);
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}
