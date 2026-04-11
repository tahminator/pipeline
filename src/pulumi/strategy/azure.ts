import {
  LocalWorkspace,
  type PreviewResult,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";

import type { PulumiClientAzureStrategyArgs } from "../types";
import type { IPulumiClientStrategy } from "./types";

export class AzurePulumiClientStrategy implements IPulumiClientStrategy {
  private constructor(private readonly stack: Stack) {}

  static async create(
    args: PulumiClientAzureStrategyArgs,
  ): Promise<AzurePulumiClientStrategy> {
    const stack = await LocalWorkspace.createOrSelectStack(
      {
        stackName: args.stackName,
        workDir: args.workDir,
      },
      {
        envVars: {
          ...Object.fromEntries(
            Object.entries(args.envs).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
        },
      },
    );

    return new AzurePulumiClientStrategy(stack);
  }

  async up(): Promise<UpResult> {
    return this.stack.up({
      color: "never",
      refresh: false,
    });
  }

  async preview(): Promise<PreviewResult> {
    return this.stack.preview({
      color: "never",
      refresh: false,
    });
  }
}
