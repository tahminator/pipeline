export type PulumiPreviewResult = {
  cliOutput: string;
};

export type PulumiUpResult = {
  cliOutput: string;
};

export interface IPulumiClientStrategy {
  up(): Promise<PulumiUpResult>;
  preview(): Promise<PulumiPreviewResult>;
}
