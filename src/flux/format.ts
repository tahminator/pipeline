import type {
  FluxDiffResult,
  FluxKustomizationDiff,
  FluxObjectDiff,
} from "./types";

export type FormatFluxDiffOpts = {
  /** @default "Flux diff" */
  title?: string;
  /** extra markdown shown under the title, e.g. how secrets are displayed */
  description?: string;
  /**
   * when set, diffs are replaced by a summary and a link here
   * (used when the full comment would exceed GitHub's size limit)
   */
  artifactUrl?: string;
};

/** Formats a {@link FluxDiffResult} as a markdown PR comment. */
export function formatFluxDiff(
  result: FluxDiffResult,
  { title = "Flux diff", description, artifactUrl }: FormatFluxDiffOpts = {},
): string {
  const base = `\`${result.baseRef.slice(0, 7)}\``;
  const lines = [`### ${title}`, ""];
  if (description) {
    lines.push(description, "");
  }

  lines.push(
    result.changed.length === 0
      ? `No Flux Kustomization renders differently against ${base}.`
      : `${result.changed.length} Flux Kustomization(s) render differently against ${base}.`,
    "",
  );

  if (artifactUrl) {
    lines.push(
      `> [!WARNING]`,
      `> The rendered diff is too long for a GitHub comment. [Download the full diff from the workflow run](${artifactUrl}).`,
      "",
    );
    for (const change of result.changed) {
      lines.push(`- ${summary(change)}`);
      if (change.buildError) {
        lines.push("  - `kustomize build` failed");
      }
      lines.push(
        ...change.objects.map((object) => `  - ${objectSummary(object)}`),
      );
    }
    lines.push("");
  } else {
    for (const change of result.changed) {
      lines.push(
        `<details><summary>${summary(change)}</summary>`,
        "",
        ...change.notes.map((note) => `> ${note}\n`),
      );
      if (change.buildError) {
        lines.push(
          "`kustomize build` failed:",
          "",
          "````text",
          change.buildError,
          "````",
          "",
        );
      }
      for (const object of change.objects) {
        lines.push(
          objectSummary(object),
          "",
          "````diff",
          object.diff.trimEnd(),
          "````",
          "",
        );
      }
      lines.push("</details>", "");
    }
  }

  if (result.skipped.length > 0) {
    lines.push(
      `<details><summary>${result.skipped.length} Flux Kustomization(s) not rendered</summary>`,
      "",
      ...result.skipped.map(
        (skipped) => `- <code>${label(skipped)}</code>: ${skipped.reason}`,
      ),
      "",
      "</details>",
      "",
    );
  }

  return lines.join("\n");
}

export function label({
  name,
  namespace,
}: {
  name: string;
  namespace: string;
}): string {
  return namespace ? `${namespace}/${name}` : name;
}

function summary(change: FluxKustomizationDiff): string {
  const counts = change.buildError
    ? "build failed"
    : `${change.objects.length} object(s), +${change.additions} −${change.deletions}`;
  return `<code>${label(change)}</code> — <code>${change.path}</code> (${change.status}, ${counts})`;
}

function objectSummary(object: FluxObjectDiff): string {
  const name = [object.namespace, object.name].filter(Boolean).join("/");
  const file = object.file ? ` — \`${object.file}\`` : "";
  return `**\`${object.kind}\` \`${name}\`**${file} (${object.status}, +${object.additions} −${object.deletions})`;
}
