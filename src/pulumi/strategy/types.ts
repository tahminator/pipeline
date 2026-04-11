import type { PreviewResult, UpResult } from "@pulumi/pulumi/automation";

export type ChargedPreviewOutput = PreviewResult & {
  cliOutput: string;
};

export interface IPulumiClientStrategy {
  up(): Promise<UpResult>;
  preview(): Promise<ChargedPreviewOutput>;
}
