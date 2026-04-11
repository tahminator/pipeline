import {
  LocalWorkspace,
  type PreviewResult,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";

import type { PulumiClientAzureStrategyArgs as PulumiClientAzureStrategyConfig } from "../types";
import type { IPulumiClientStrategy } from "./types";

export class AzurePulumiClientStrategy implements IPulumiClientStrategy {
  private constructor(private readonly stack: Stack) {}

  static async create(
    args: PulumiClientAzureStrategyConfig,
  ): Promise<AzurePulumiClientStrategy> {
    const stack = await LocalWorkspace.createOrSelectStack(
      {
        stackName: args.stackName,
        workDir: args.workDir,
      },
      {
        envVars: {
          ...args.envs,
        },
      },
    );

    return new AzurePulumiClientStrategy(stack);
  }

  async up(): Promise<UpResult> {
    return this.stack.up({
      color: "never",
      diff: true,
      refresh: true,
    });
  }

  async preview(): Promise<PreviewResult> {
    return this.stack.preview({
      color: "never",
      diff: true,
      refresh: true,
    });
  }
}
