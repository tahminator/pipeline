import type {
  PreviewResult,
  RefreshResult,
  UpResult,
} from "@pulumi/pulumi/automation";

export interface IPulumiClientStrategy {
  up(): Promise<UpResult>;
  preview(opts: {
    diff: boolean;
    rewriteStdoutToColorizedHtml: boolean;
  }): Promise<PreviewResult>;
  refresh(): Promise<RefreshResult>;
}
