import type {
  PreviewResult,
  RefreshResult,
  UpResult,
} from "@pulumi/pulumi/automation";

export interface IPulumiClientStrategy {
  up(): Promise<UpResult>;
  preview(opts: { diff: boolean }): Promise<PreviewResult>;
  refresh(): Promise<RefreshResult>;
}
