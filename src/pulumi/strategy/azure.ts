import {
  LocalWorkspace,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";

import type { PulumiClientAzureStrategyArgs } from "../types";
import type { ChargedPreviewOutput, IPulumiClientStrategy } from "./types";

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
      refresh: true,
    });
  }

  async preview(): Promise<ChargedPreviewOutput> {
    let buffer = "";
    const result = await this.stack.preview({
      onOutput: (out) => {
        buffer += out;
      },
      refresh: true,
    });

    return {
      ...result,
      cliOutput: buffer,
    };
  }
}
