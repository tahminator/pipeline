import type { LocalProgramArgs } from "@pulumi/pulumi/automation";

import type { LiteralUnion } from "../types";

export enum PulumiClientStrategy {
  AZURE = 0,
  CLOUDFLARE,
}

export interface IPulumiClientStrategyArgs {
  strategy: PulumiClientStrategy;
  envs: Record<string, string | undefined>;
  useCli?: boolean;
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

export interface PulumiClientCloudflareStrategyArgs
  extends IPulumiClientStrategyArgs, LocalProgramArgs {
  strategy: PulumiClientStrategy.CLOUDFLARE;
  envs: {
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    PULUMI_BACKEND_URL: LiteralUnion<`s3://${string}?endpoint=${string}.r2.cloudflarestorage.com${string}`>;
    [_: string]: string | undefined;
  };
}

export type PulumiClientStrategiesArgs =
  | PulumiClientAzureStrategyArgs
  | PulumiClientCloudflareStrategyArgs;

export type PulumiClientCreateArgs = PulumiClientStrategiesArgs &
  LocalProgramArgs;
