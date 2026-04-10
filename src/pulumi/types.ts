import type { LocalProgramArgs } from "@pulumi/pulumi/automation";

export enum PulumiClientStrategy {
  AZURE = 1,
}

export interface IPulumiClientStrategyArgs {
  strategy: PulumiClientStrategy;
  auth: Record<string, unknown>;
  stateFile: Record<string, unknown>;
}

export interface PulumiClientAzureStrategy
  extends IPulumiClientStrategyArgs, LocalProgramArgs {
  strategy: PulumiClientStrategy.AZURE;
  auth: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    subscriptionId: string;
  };
  stateFile: {
    azureStateLocation: string;
  };
}

export type PulumiClientStrategies = PulumiClientAzureStrategy;

export type PulumiClientCreateArgs = PulumiClientStrategies & LocalProgramArgs;
