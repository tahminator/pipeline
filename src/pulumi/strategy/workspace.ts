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

  async preview(args: { diff: boolean } | undefined): Promise<PreviewResult> {
    const { diff } = args ?? { diff: false };
    return this.stack.preview({
      color: "never",
      refresh: false,
      diff,
    });
  }

  async refresh(): Promise<RefreshResult> {
    return this.stack.refresh({
      color: "never",
    });
  }
}
