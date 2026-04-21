import {
  LocalWorkspace,
  type PreviewResult,
  type RefreshResult,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";
import Convert from "ansi-to-html";

import type { PulumiClientCreateArgs } from "../types";
import type { IPulumiClientStrategy } from "./types";

export class LocalWorkspacePulumiClientStrategy implements IPulumiClientStrategy {
  private readonly htmlToAnsiConverter: Convert = new Convert();
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
    args: { diff: boolean; rewriteStdoutToColorizedHtml: boolean } | undefined,
  ): Promise<PreviewResult> {
    const { diff, rewriteStdoutToColorizedHtml: colorizedHtml } = args ?? {
      diff: false,
      rewriteStdoutToColorizedHtml: false,
    };
    const previewResult = await this.stack.preview({
      color: colorizedHtml ? "always" : "never",
      refresh: false,
      diff,
    });

    return {
      ...previewResult,
      stdout: this.htmlToAnsiConverter.toHtml(previewResult.stdout),
    };
  }

  async refresh(): Promise<RefreshResult> {
    return this.stack.refresh({
      color: "never",
    });
  }
}
