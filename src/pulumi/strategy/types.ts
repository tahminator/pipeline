import type { PreviewResult, UpResult } from "@pulumi/pulumi/automation";

export interface IPulumiClientStrategy {
  up(): Promise<UpResult>;
  preview(opts: { diff: boolean }): Promise<PreviewResult>;
}
