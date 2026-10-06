import { $ } from "bun";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { GitHubClient } from "../gh";

import { findFluxKustomizations } from "./discover";
import { formatFluxDiff, type FormatFluxDiffOpts, label } from "./format";
import { objectKey, renderKustomization, type RenderedObject } from "./render";
import {
  type FluxClientOpts,
  type FluxDiffResult,
  type FluxKustomization,
  type FluxKustomizationDiff,
  type FluxObjectDiff,
  type FluxSkippedKustomization,
} from "./types";

/** GitHub rejects comment bodies above 65536 characters. */
const MAX_COMMENT_LENGTH = 65_536;

const DEFAULT_INCLUDE = ["**/*.yaml", "**/*.yml"];

/**
 * Works with a repository of Flux manifests: finds its Flux `Kustomization`s, renders them the
 * way kustomize-controller would, and reports how a change affects the rendered output.
 *
 * Requires `git`, `diff` and `kustomize` on `PATH`.
 */
export class FluxClient {
  private readonly include: string[];
  private readonly isLocalSource: NonNullable<FluxClientOpts["isLocalSource"]>;

  constructor(
    private readonly ghClient: GitHubClient,
    opts: FluxClientOpts = {},
  ) {
    this.include = opts.include ?? DEFAULT_INCLUDE;
    this.isLocalSource =
      opts.isLocalSource ?? ((sourceRef) => sourceRef.kind === "GitRepository");
  }

  /** Returns every Flux `Kustomization` declared under `root`. */
  findKustomizations(root = "."): Promise<FluxKustomization[]> {
    return findFluxKustomizations(root, this.include);
  }

  /**
   * Renders every Flux `Kustomization` at `baseRef` and in the working tree at `root`,
   * and posts the ones whose output differs as a new PR comment.
   *
   * `baseRef` is fetched from `origin` if it is not available locally (e.g. shallow CI clones).
   * If the comment would exceed GitHub's size limit, the full comment is uploaded as an
   * artifact of the current workflow run and the PR comment links to it instead.
   */
  async diff({
    baseRef,
    root = ".",
    owner,
    repository,
    prId,
    ...formatOpts
  }: {
    baseRef: string;
    root?: string;
    owner: string;
    repository: string;
    prId: number;
  } & Omit<FormatFluxDiffOpts, "artifactUrl">): Promise<void> {
    const result = await this.collectDiff(baseRef, root);

    const full = formatFluxDiff(result, formatOpts);
    if (full.length <= MAX_COMMENT_LENGTH) {
      await this.ghClient.sendPrMessage({
        owner,
        repository,
        prId,
        message: full,
      });
      return;
    }

    const dir = await mkdtemp(path.join(tmpdir(), "flux-diff-artifact-"));
    try {
      const file = path.join(dir, "flux-diff.md");
      await Bun.write(file, full);
      const attempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
      const { url } = await this.ghClient.uploadArtifact({
        name: `flux-diff-pr-${prId}-attempt-${attempt}`,
        files: [file],
        rootDirectory: dir,
      });

      const message = formatFluxDiff(result, {
        ...formatOpts,
        artifactUrl: url,
      });
      await this.ghClient.sendPrMessage({ owner, repository, prId, message });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async collectDiff(
    baseRef: string,
    root: string,
  ): Promise<FluxDiffResult> {
    const workdir = await mkdtemp(path.join(tmpdir(), "flux-diff-"));
    const baseRoot = path.join(workdir, "base");

    await $`git -C ${root} fetch --depth=1 origin ${baseRef}`.quiet().nothrow();
    await $`git -C ${root} worktree add --detach ${baseRoot} ${baseRef}`.quiet();

    try {
      const [baseKustomizations, headKustomizations] = await Promise.all([
        this.findKustomizations(baseRoot),
        this.findKustomizations(root),
      ]);

      const pairs = new Map<
        string,
        { base?: FluxKustomization; head?: FluxKustomization }
      >();
      for (const kustomization of baseKustomizations) {
        pairs.set(label(kustomization), { base: kustomization });
      }
      for (const kustomization of headKustomizations) {
        const key = label(kustomization);
        pairs.set(key, { ...pairs.get(key), head: kustomization });
      }

      const changed: FluxKustomizationDiff[] = [];
      const skipped: FluxSkippedKustomization[] = [];
      let nextDiffId = 0;
      const nextDiffDir = () =>
        path.join(workdir, "diffs", String(nextDiffId++));

      await Promise.all(
        [...pairs.values()].map(async ({ base, head }) => {
          const current = (head ?? base) as FluxKustomization;
          const { name, namespace } = current;

          const unrenderable = [base, head].find(
            (kustomization) =>
              kustomization &&
              !this.isLocalSource(kustomization.spec.sourceRef),
          );
          if (unrenderable) {
            const { kind, name: sourceName } = unrenderable.spec.sourceRef;
            skipped.push({
              name,
              namespace,
              reason: `source \`${kind}/${sourceName}\` is not this repository`,
            });
            return;
          }

          const [baseRender, headRender] = await Promise.all([
            base ? renderKustomization(baseRoot, base) : undefined,
            head ? renderKustomization(root, head) : undefined,
          ]);

          const buildError = headRender?.error;
          const objects =
            buildError ?
              []
            : await diffObjects(
                baseRender?.objects ?? [],
                headRender?.objects ?? [],
                nextDiffDir,
              );
          const unchanged =
            buildError ?
              buildError === baseRender?.error
            : objects.length === 0;
          if (unchanged) {
            return;
          }

          const notes = new Set([
            ...(baseRender?.notes ?? []),
            ...(headRender?.notes ?? []),
          ]);
          if (baseRender?.error && !buildError) {
            notes.add(
              "`kustomize build` fails at the base commit, so every object is shown as added.",
            );
          }

          changed.push({
            name,
            namespace,
            path: current.path,
            status:
              !base ? "added"
              : !head ? "removed"
              : "changed",
            objects,
            ...(buildError ? { buildError } : {}),
            additions: objects.reduce((sum, o) => sum + o.additions, 0),
            deletions: objects.reduce((sum, o) => sum + o.deletions, 0),
            notes: [...notes],
          });
        }),
      );

      const byLabel = (a: { name: string; namespace: string }, b: typeof a) =>
        label(a).localeCompare(label(b));
      return {
        baseRef,
        changed: changed.sort(byLabel),
        skipped: skipped.sort(byLabel),
      };
    } finally {
      await $`git -C ${root} worktree remove --force ${baseRoot}`
        .quiet()
        .nothrow();
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

/** Pairs base and head objects by {@link objectKey} and diffs the ones whose rendered YAML differs. */
async function diffObjects(
  baseObjects: RenderedObject[],
  headObjects: RenderedObject[],
  nextDir: () => string,
): Promise<FluxObjectDiff[]> {
  const pairs = new Map<
    string,
    { base?: RenderedObject; head?: RenderedObject }
  >();
  for (const object of baseObjects) {
    pairs.set(objectKey(object), { base: object });
  }
  for (const object of headObjects) {
    const k = objectKey(object);
    pairs.set(k, { ...pairs.get(k), head: object });
  }

  const diffs = await Promise.all(
    [...pairs.values()].map(async ({ base, head }) => {
      if (base?.yaml === head?.yaml) {
        return null;
      }
      const current = (head ?? base) as RenderedObject;
      const { kind, namespace, name, file } = current;
      const diff = await unifiedDiff(
        nextDir(),
        [kind, namespace, name].filter(Boolean).join("/"),
        base?.yaml ?? "",
        head?.yaml ?? "",
      );
      const lines = diff.split("\n");
      const objectDiff: FluxObjectDiff = {
        kind,
        namespace,
        name,
        ...(file ? { file } : {}),
        status:
          !base ? "added"
          : !head ? "removed"
          : "changed",
        diff,
        additions: lines.filter(
          (line) => line.startsWith("+") && !line.startsWith("+++"),
        ).length,
        deletions: lines.filter(
          (line) => line.startsWith("-") && !line.startsWith("---"),
        ).length,
      };
      return objectDiff;
    }),
  );

  return diffs
    .filter((diff): diff is FluxObjectDiff => diff !== null)
    .sort(
      (a, b) =>
        // objects without a recorded file sort last
        (a.file ?? "\uffff").localeCompare(b.file ?? "\uffff") ||
        a.kind.localeCompare(b.kind) ||
        a.namespace.localeCompare(b.namespace) ||
        a.name.localeCompare(b.name),
    );
}

async function unifiedDiff(
  dir: string,
  targetPath: string,
  baseOutput: string,
  headOutput: string,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const baseFile = path.join(dir, "base.yaml");
  const headFile = path.join(dir, "head.yaml");
  await Promise.all([
    Bun.write(baseFile, baseOutput),
    Bun.write(headFile, headOutput),
  ]);

  const result =
    await $`diff -u --label ${`a/${targetPath}`} --label ${`b/${targetPath}`} ${baseFile} ${headFile}`
      .quiet()
      .nothrow();
  // diff exits 1 when the files differ and 2 on error
  if (result.exitCode > 1) {
    throw new Error(`diff failed for ${targetPath}: ${result.stderr}`);
  }
  return result.stdout.toString();
}
