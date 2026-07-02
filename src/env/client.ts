import {
  type IEnvClientStrategy,
  SopsEnvClientStrategy,
  GitCryptEnvClientStrategy,
} from "./strategy";
import { EnvClientStrategy, type EnvClientReadOpts } from "./types";

export type EnvClientOpts = {
  /**
   * Skip GitHub Actions secret masking. Defaults to `false`.
   *
   * **NOTE**: Be very careful if you set this to `true`!
   */
  skipMasking?: boolean;
};

export class EnvClient {
  private constructor(
    private readonly strategy: IEnvClientStrategy,
    private readonly opts: EnvClientOpts,
  ) {}

  static create(
    strategy: EnvClientStrategy,
    opts: EnvClientOpts = {
      skipMasking: false,
    },
  ) {
    switch (strategy) {
      case EnvClientStrategy.SOPS:
        return new this(new SopsEnvClientStrategy(), opts);
      case EnvClientStrategy.GIT_CRYPT:
        return new this(new GitCryptEnvClientStrategy(), opts);
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
    const r = Object.fromEntries(envs);
    if (this.opts.skipMasking) {
      return r;
    }

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
        for (const line of lines) {
          if (!line.trim().length) continue;
          console.log(`::add-mask::${line}`);
        }
      }
    }

    return r;
  }
}
