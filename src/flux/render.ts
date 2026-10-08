import { $ } from "bun";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

import type { FluxKustomization } from "./types";

const KUSTOMIZATION_FILES = [
  "kustomization.yaml",
  "kustomization.yml",
  "Kustomization",
];

const SUBSTITUTE_DISABLED =
  /kustomize\.toolkit\.fluxcd\.io\/substitute:\s*["']?disabled["']?/;

/** `${VAR}`, `${VAR:-default}`, `${VAR-default}`, `${VAR:=default}`, `${VAR=default}`; `$${VAR}` escapes. */
const VARIABLE = /\$(\$)?\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-=])([^}]*))?\}/g;

/** kustomize's `originAnnotations` build metadata; records the file that defines each object. */
const ORIGIN_ANNOTATION = "config.kubernetes.io/origin";

const GENERATORS = ["ConfigMapGenerator", "SecretGenerator"];

/** kustomize's name hash: 10 characters from its vowel-free alphabet, appended last. */
const NAME_HASH = /-[2456789bcdfghkmt]{10}$/;

export type RenderedObject = {
  apiVersion: string;
  kind: string;
  namespace: string;
  name: string;
  /**
   * repository-relative file that defines the object (for generated objects, the
   * kustomization.yaml whose generator creates it); `undefined` if kustomize did not record one
   */
  file?: string;
  /** created by a ConfigMap/Secret generator, so `name` may end in a content hash */
  generated: boolean;
  /** the object's rendered YAML, without the origin annotation */
  yaml: string;
};

/**
 * Identifies the same object across two renders: API group, kind, namespace and name.
 * An apiVersion bump within a group keeps the key; generated objects drop the content hash
 * from their name so an edited ConfigMap/Secret pairs with its previous version.
 */
export function objectKey(object: RenderedObject): string {
  const group = object.apiVersion.includes("/")
    ? object.apiVersion.split("/")[0]
    : "";
  const name = object.generated
    ? object.name.replace(NAME_HASH, "")
    : object.name;
  return [group, object.kind, object.namespace, name].join("\0");
}

type RenderedKustomization = {
  /** rendered objects, in kustomize's output order; empty when `error` is set */
  objects: RenderedObject[];
  /** `kustomize build` error output, when the build failed */
  error?: string;
  notes: string[];
};

/**
 * Renders a Flux `Kustomization` the way kustomize-controller does: `kustomize build` of
 * `spec.path` with the overlay fields from the spec (`targetNamespace`, `namePrefix`,
 * `nameSuffix`, `components`, `images`, `patches`, `commonMetadata`) applied on top,
 * followed by `postBuild` variable substitution.
 *
 * Each rendered object records the file that defines it.
 */
export async function renderKustomization(
  root: string,
  kustomization: FluxKustomization,
): Promise<RenderedKustomization> {
  const notes: string[] = [];
  const { spec } = kustomization;
  const targetDir = path.join(root, kustomization.path);

  // kustomize rejects absolute resource paths, so the wrapper must live inside `root`
  const wrapper = await mkdtemp(path.join(root, ".flux-render-"));
  try {
    const relative = (to: string) => path.relative(wrapper, to);

    let resources = [relative(targetDir)];
    if (!(await hasKustomizationFile(targetDir))) {
      resources = (await generateResources(targetDir)).map(relative);
      notes.push(
        `\`${kustomization.path}\` has no kustomization.yaml; resources were generated the way Flux does.`,
      );
    }

    const wrapperKustomization = {
      apiVersion: "kustomize.config.k8s.io/v1beta1",
      kind: "Kustomization",
      namespace: spec.targetNamespace,
      namePrefix: spec.namePrefix,
      nameSuffix: spec.nameSuffix,
      resources,
      components: spec.components?.map((component) =>
        relative(path.join(targetDir, component)),
      ),
      images: spec.images,
      patches: spec.patches,
      labels: spec.commonMetadata?.labels
        ? [{ pairs: spec.commonMetadata.labels, includeSelectors: false }]
        : undefined,
      commonAnnotations: spec.commonMetadata?.annotations,
      buildMetadata: ["originAnnotations"],
    };
    await Bun.write(
      path.join(wrapper, "kustomization.yaml"),
      yaml.stringify(wrapperKustomization),
    );

    const result =
      await $`kustomize build --load-restrictor LoadRestrictionsNone ${wrapper}`
        .quiet()
        .nothrow();
    if (result.exitCode !== 0) {
      return { objects: [], error: result.stderr.toString().trim(), notes };
    }

    let output = result.stdout.toString();
    if (spec.postBuild) {
      const hasExternalValues =
        (spec.postBuild.substituteFrom ?? []).length > 0;
      const substituted = substituteVariables(
        output,
        spec.postBuild.substitute ?? {},
        { keepUnresolved: hasExternalValues },
      );
      output = substituted.output;
      if (substituted.unresolved.length > 0) {
        notes.push(
          `\`postBuild.substituteFrom\` values live in the cluster and were left unresolved: ${substituted.unresolved
            .map((name) => `\`\${${name}}\``)
            .join(", ")}.`,
        );
      }
    }

    const docs = yaml.parseAllDocuments(output);
    const invalid = docs.find((doc) => doc.errors.length > 0);
    if (invalid) {
      return {
        objects: [],
        error: `rendered output is not valid YAML: ${invalid.errors[0]?.message}`,
        notes,
      };
    }

    const objects = docs
      .filter((doc) => doc.contents !== null)
      .map((doc) => toRenderedObject(doc, root, wrapper));
    return { objects, notes };
  } finally {
    await rm(wrapper, { recursive: true, force: true });
  }
}

function toRenderedObject(
  doc: yaml.Document,
  root: string,
  wrapper: string,
): RenderedObject {
  const raw = doc.getIn(["metadata", "annotations", ORIGIN_ANNOTATION]);
  doc.deleteIn(["metadata", "annotations", ORIGIN_ANNOTATION]);
  const annotations = doc.getIn(["metadata", "annotations"]);
  if (yaml.isMap(annotations) && annotations.items.length === 0) {
    doc.deleteIn(["metadata", "annotations"]);
  }
  const origin = typeof raw === "string" ? (yaml.parse(raw) as Origin) : null;

  const value = (doc.toJS() ?? {}) as {
    apiVersion?: unknown;
    kind?: unknown;
    metadata?: { name?: unknown; namespace?: unknown };
  };
  return {
    apiVersion: String(value.apiVersion ?? ""),
    kind: String(value.kind ?? ""),
    namespace: String(value.metadata?.namespace ?? ""),
    name: String(value.metadata?.name ?? ""),
    file: origin ? originFile(origin, root, wrapper) : undefined,
    generated: GENERATORS.includes(origin?.configuredBy?.kind ?? ""),
    yaml: doc.toString({ lineWidth: 0 }).replace(/^---\n/, ""),
  };
}

type Origin = {
  path?: string;
  repo?: string;
  ref?: string;
  configuredIn?: string;
  configuredBy?: { kind?: string };
};

/**
 * Converts an origin annotation (`path`, or `configuredIn` for generated objects, relative to
 * the wrapper kustomization) to a repository-relative path. Remote origins are returned as
 * `<repo>//<path>?ref=<ref>`.
 */
function originFile(
  origin: Origin,
  root: string,
  wrapper: string,
): string | undefined {
  const file = origin.path ?? origin.configuredIn;
  if (origin.repo) {
    return `${origin.repo}//${file ?? ""}${origin.ref ? `?ref=${origin.ref}` : ""}`;
  }
  return file ? path.relative(root, path.resolve(wrapper, file)) : undefined;
}

/**
 * Applies Flux `postBuild` substitution to rendered multi-document YAML. Documents annotated
 * with `kustomize.toolkit.fluxcd.io/substitute: disabled` are left untouched.
 *
 * Variables without a value and without a default become empty strings, as in Flux, unless
 * `keepUnresolved` is set (used when some values come from `substituteFrom` and are unknown).
 */
export function substituteVariables(
  input: string,
  vars: Record<string, string>,
  { keepUnresolved }: { keepUnresolved: boolean },
): { output: string; unresolved: string[] } {
  const unresolved = new Set<string>();

  const output = input
    .split(/^(?=---$)/m)
    .map((doc) => {
      if (SUBSTITUTE_DISABLED.test(doc)) {
        return doc;
      }
      return doc.replace(
        VARIABLE,
        (
          match,
          escape: string | undefined,
          name: string,
          operator: string | undefined,
          fallback: string | undefined,
        ) => {
          if (escape) {
            return match.slice(1);
          }
          const value = vars[name];
          if (operator !== undefined) {
            const useValue =
              value !== undefined &&
              (!operator.startsWith(":") || value !== "");
            return useValue ? value : (fallback ?? "");
          }
          if (value !== undefined) {
            return value;
          }
          if (keepUnresolved) {
            unresolved.add(name);
            return match;
          }
          return "";
        },
      );
    })
    .join("");

  return { output, unresolved: [...unresolved].sort() };
}

async function hasKustomizationFile(dir: string): Promise<boolean> {
  const entries = await readdir(dir).catch(() => []);
  return entries.some((entry) => KUSTOMIZATION_FILES.includes(entry));
}

/**
 * Mirrors Flux's generated kustomization for a path without one: every Kubernetes manifest
 * under `dir`, with subdirectories that have their own kustomization included as a whole.
 */
async function generateResources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const resources: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await hasKustomizationFile(full)) {
        resources.push(full);
      } else {
        resources.push(...(await generateResources(full)));
      }
    } else if (/\.ya?ml$/.test(entry.name) && (await isManifest(full))) {
      resources.push(full);
    }
  }

  return resources;
}

async function isManifest(file: string): Promise<boolean> {
  const docs = yaml.parseAllDocuments(await Bun.file(file).text());
  return docs.some((doc) => {
    const value = doc.errors.length === 0 ? doc.toJS() : undefined;
    return (
      typeof value?.apiVersion === "string" && typeof value?.kind === "string"
    );
  });
}
