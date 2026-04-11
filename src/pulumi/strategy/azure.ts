import { $ } from "bun";

import type { PulumiClientAzureStrategyArgs } from "../types";
import type {
  PulumiPreviewResult,
  IPulumiClientStrategy,
  PulumiUpResult,
} from "./types";

export class AzurePulumiClientStrategy implements IPulumiClientStrategy {
  private readonly env: Record<string, string>;

  private constructor(private readonly args: PulumiClientAzureStrategyArgs) {
    this.env = Object.fromEntries(
      Object.entries(this.args.envs).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
  }

  static async create(
    args: PulumiClientAzureStrategyArgs,
  ): Promise<AzurePulumiClientStrategy> {
    return new AzurePulumiClientStrategy(args);
  }

  async up(): Promise<PulumiUpResult> {
    const cliOutput = await this.runPulumiCmd(["up", "--yes"]);

    return { cliOutput };
  }

  async preview(): Promise<PulumiPreviewResult> {
    const cliOutput = await this.runPulumiCmd(["preview"]);

    return { cliOutput };
  }

  private async runPulumiCmd(args: string[]): Promise<string> {
    return $`pulumi ${args} --stack ${this.args.stackName}`
      .cwd(this.args.workDir)
      .env({ ...process.env, ...this.env })
      .text();
  }
}
