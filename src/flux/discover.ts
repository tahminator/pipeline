import { Glob } from "bun";
import path from "node:path";
import { parseAllDocuments } from "yaml";

import { type FluxKustomization, fluxKustomizationSchema } from "./types";

const FLUX_API_GROUP = "kustomize.toolkit.fluxcd.io/";

/**
 * Returns every Flux `Kustomization` declared in files under `root` matching `include`,
 * sorted by namespace then name. Hidden directories and `node_modules` are never scanned.
 */
export async function findFluxKustomizations(
  root: string,
  include: string[],
): Promise<FluxKustomization[]> {
  const files = new Set<string>();
  for (const pattern of include) {
    for await (const file of new Glob(pattern).scan({ cwd: root })) {
      if (!file.split(path.sep).includes("node_modules")) {
        files.add(file);
      }
    }
  }

  const found = await Promise.all(
    [...files].map(async (file) => {
      const content = await Bun.file(path.join(root, file)).text();
      // cheap pre-filter; most YAML in a manifest repo is not a Flux Kustomization
      if (!content.includes(FLUX_API_GROUP)) {
        return [];
      }
      return parseFile(file, content);
    }),
  );

  return found
    .flat()
    .sort(
      (a, b) =>
        a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name),
    );
}

function parseFile(file: string, content: string): FluxKustomization[] {
  const kustomizations: FluxKustomization[] = [];
  for (const doc of parseAllDocuments(content)) {
    if (doc.errors.length > 0) {
      continue;
    }
    const parsed = fluxKustomizationSchema.safeParse(doc.toJS());
    if (!parsed.success) {
      continue;
    }
    const { metadata, spec } = parsed.data;
    kustomizations.push({
      file,
      name: metadata.name,
      namespace: metadata.namespace ?? "",
      path: path.normalize(spec.path ?? "."),
      spec,
    });
  }
  return kustomizations;
}
