import z from "zod";

/**
 * The subset of a Flux `Kustomization` (`kustomize.toolkit.fluxcd.io`) that affects rendered output.
 */
export const fluxKustomizationSchema = z.object({
  apiVersion: z.string().startsWith("kustomize.toolkit.fluxcd.io/"),
  kind: z.literal("Kustomization"),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  spec: z.object({
    path: z.string().optional(),
    sourceRef: z.object({
      kind: z.string(),
      name: z.string(),
      namespace: z.string().optional(),
    }),
    targetNamespace: z.string().optional(),
    namePrefix: z.string().optional(),
    nameSuffix: z.string().optional(),
    components: z.array(z.string()).optional(),
    images: z
      .array(
        z.object({
          name: z.string(),
          newName: z.string().optional(),
          newTag: z.string().optional(),
          digest: z.string().optional(),
        }),
      )
      .optional(),
    patches: z
      .array(
        z.object({
          patch: z.string(),
          target: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    commonMetadata: z
      .object({
        labels: z.record(z.string(), z.string()).optional(),
        annotations: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
    postBuild: z
      .object({
        substitute: z.record(z.string(), z.string()).optional(),
        substituteFrom: z.array(z.unknown()).optional(),
      })
      .optional(),
  }),
});

type FluxKustomizationSpec = z.infer<typeof fluxKustomizationSchema>["spec"];

/** A Flux `Kustomization` found in the repository. */
export type FluxKustomization = {
  /** repository-relative file the Kustomization is declared in */
  file: string;
  name: string;
  /** `metadata.namespace`, or `""` when the manifest leaves it to an enclosing kustomization */
  namespace: string;
  /** normalized, repository-relative `spec.path` */
  path: string;
  spec: FluxKustomizationSpec;
};

export type FluxSourceRef = FluxKustomizationSpec["sourceRef"];

type FluxDiffStatus = "added" | "changed" | "removed";

/** A rendered Kubernetes object whose output differs between base and head. */
export type FluxObjectDiff = {
  kind: string;
  /** `""` for cluster-scoped objects */
  namespace: string;
  name: string;
  /**
   * repository-relative file that defines the object, from kustomize's origin annotations.
   * Generated objects (ConfigMap/Secret generators) point at the kustomization.yaml that
   * generates them. Files that only patch the object are not recorded.
   */
  file?: string;
  status: FluxDiffStatus;
  /** unified diff of the object's rendered YAML */
  diff: string;
  additions: number;
  deletions: number;
};

export type FluxKustomizationDiff = {
  name: string;
  namespace: string;
  path: string;
  status: FluxDiffStatus;
  /** changed objects, sorted by file then kind, namespace and name */
  objects: FluxObjectDiff[];
  /** `kustomize build` error at head; `objects` is empty when set */
  buildError?: string;
  /** totals across `objects` */
  additions: number;
  deletions: number;
  /** caveats about how faithful the render is, e.g. unresolvable `substituteFrom` variables */
  notes: string[];
};

export type FluxSkippedKustomization = {
  name: string;
  namespace: string;
  reason: string;
};

export type FluxDiffResult = {
  baseRef: string;
  /** Kustomizations whose rendered output differs, sorted by name */
  changed: FluxKustomizationDiff[];
  /** Kustomizations that could not be rendered locally */
  skipped: FluxSkippedKustomization[];
};

export type FluxClientOpts = {
  /**
   * Globs (relative to the repository root) scanned for Flux Kustomizations.
   *
   * @default ["**\/*.yaml", "**\/*.yml"]
   */
  include?: string[];
  /**
   * Decides whether a Kustomization's `sourceRef` points at the repository being diffed.
   * Kustomizations with any other source are reported as skipped.
   *
   * @default every `GitRepository` source
   */
  isLocalSource?: (sourceRef: FluxSourceRef) => boolean;
};
