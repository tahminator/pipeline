import {
  type IEnvClientStrategy,
  SopsEnvClientStrategy,
  GitCryptEnvClientStrategy,
} from "./strategy";
import { EnvClientStrategy, type EnvClientReadOpts } from "./types";

export class EnvClient {
  private constructor(private readonly strategy: IEnvClientStrategy) {}

  static create(strategy: EnvClientStrategy) {
    switch (strategy) {
      case EnvClientStrategy.SOPS:
        return new this(new SopsEnvClientStrategy());
      case EnvClientStrategy.GIT_CRYPT:
        return new this(new GitCryptEnvClientStrategy());
    }
  }

  async readFromEnv(
    fileName: string,
    opts?: EnvClientReadOpts,
  ): Promise<Record<string, string>> {
    return this.maskAndReturnEnv(
      await this.strategy.readFromEnv(fileName, opts),
    );
  }

  private maskAndReturnEnv(envs: Map<string, string>): Record<string, string> {
    for (const [varName, value] of envs.entries()) {
      if (value === "true" || value === "false" || value === "") {
        console.log(`Not masking ${varName}: true/false/empty value`);
        continue;
      }

      console.log(`Masking ${varName}`);

      const lines = value.split("\n");
      if (lines.length == 1) {
        console.log(`::add-mask::${value}`);
      } else {
        lines.forEach((line) => {
          console.log(`::add-mask::${line}`);
        });
      }
    }

    return Object.fromEntries(envs);
  }
}
