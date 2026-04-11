import type { EnvClientReadOpts } from "../types";

export interface IEnvClientStrategy {
  readFromEnv(
    fileName: string,
    opts?: EnvClientReadOpts,
  ): Promise<Map<string, string>>;
}
