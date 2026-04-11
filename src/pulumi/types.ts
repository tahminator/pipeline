import type { LocalProgramArgs } from "@pulumi/pulumi/automation";

import type { LiteralUnion } from "../types";

export enum PulumiClientStrategy {
  AZURE = 0,
}

export interface IPulumiClientStrategyArgs {
  strategy: PulumiClientStrategy;
  envs: Record<string, string | undefined>;
}

export interface PulumiClientAzureStrategyArgs
  extends IPulumiClientStrategyArgs, LocalProgramArgs {
  strategy: PulumiClientStrategy.AZURE;
  envs: {
    ARM_CLIENT_ID?: string;
    ARM_CLIENT_SECRET?: string;
    ARM_TENANT_ID?: string;
    ARM_SUBSCRIPTION_ID?: string;
    PULUMI_BACKEND_URL: LiteralUnion<`azblob://${string}?storage_account=${string}`>;
    [_: string]: string | undefined;
  };
}

export type PulumiClientStrategiesArgs = PulumiClientAzureStrategyArgs;

export type PulumiClientCreateArgs = PulumiClientStrategiesArgs &
  LocalProgramArgs;
