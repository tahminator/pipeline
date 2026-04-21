import {
  LocalWorkspace,
  type PreviewResult,
  type RefreshResult,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";

import type { PulumiClientCreateArgs } from "../types";
import type { IPulumiClientStrategy } from "./types";

export class LocalWorkspacePulumiClientStrategy implements IPulumiClientStrategy {
  private constructor(private readonly stack: Stack) {}

  static async create(
    args: PulumiClientCreateArgs,
  ): Promise<LocalWorkspacePulumiClientStrategy> {
    const stack = await LocalWorkspace.createOrSelectStack(
      {
        stackName: args.stackName,
        workDir: args.workDir,
      },
      {
        envVars: Object.fromEntries(
          Object.entries(args.envs).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      },
    );

    return new LocalWorkspacePulumiClientStrategy(stack);
  }

  async up(): Promise<UpResult> {
    return this.stack.up({
      color: "never",
      refresh: false,
    });
  }

  async preview(
    args: { diff: boolean; rewriteStdoutToDiffFriendly: boolean } | undefined,
  ): Promise<PreviewResult> {
    const { diff, rewriteStdoutToDiffFriendly } = args ?? {
      diff: false,
      rewriteStdoutToDiffFriendly: false,
    };
    const previewResult = await this.stack.preview({
      color: "never",
      refresh: false,
      diff,
    });

    const stdout =
      rewriteStdoutToDiffFriendly ?
        this.rewritePulumiPreviewAsDiffFriendlyText(previewResult.stdout)
      : previewResult.stdout;

    return {
      ...previewResult,
      stdout,
    };
  }

  private rewritePulumiPreviewAsDiffFriendlyText(stdout: string): string {
    return stdout
      .split("\n")
      .map((line) => {
        if (!line) {
          return line;
        }

        const trimmed = line.trimStart();

        const symbol =
          trimmed.startsWith("+-") ? "!"
          : trimmed.startsWith("+") ? "+"
          : trimmed.startsWith("-") ? "-"
          : trimmed.startsWith("~") ? "!"
          : null;

        if (!symbol) {
          return line;
        }

        return symbol + line.slice(1);
      })
      .join("\n");
  }

  async refresh(): Promise<RefreshResult> {
    return this.stack.refresh({
      color: "never",
    });
  }
}
