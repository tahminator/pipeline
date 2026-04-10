import type { PreviewResult, UpResult } from "@pulumi/pulumi/automation";

import {
  AzurePulumiClientStrategy,
  type IPulumiClientStrategy,
} from "./strategy";
import { type PulumiClientCreateArgs, PulumiClientStrategy } from "./types";

export class PulumiClient {
  private constructor(private readonly strategy: IPulumiClientStrategy) {}

  static async create(args: PulumiClientCreateArgs): Promise<PulumiClient> {
    switch (args.strategy) {
      case PulumiClientStrategy.AZURE:
        return new this(await AzurePulumiClientStrategy.create(args));
    }
  }

  async up(): Promise<UpResult> {
    return this.strategy.up();
  }

  async preview(): Promise<PreviewResult> {
    return this.strategy.preview();
  }
}
