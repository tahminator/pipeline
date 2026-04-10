import {
  LocalWorkspace,
  type PreviewResult,
  type Stack,
  type UpResult,
} from "@pulumi/pulumi/automation";

import type { PulumiClientAzureStrategy as PulumiClientAzureStrategyConfig } from "../types";
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
          ARM_CLIENT_ID: args.auth.clientId,
          ARM_CLIENT_SECRET: args.auth.clientSecret,
          ARM_TENANT_ID: args.auth.tenantId,
          ARM_SUBSCRIPTION_ID: args.auth.subscriptionId,
          PULUMI_BACKEND_URL: args.stateFile.azureStateLocation,
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
