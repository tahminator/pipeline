import { $ } from "bun";
import yaml from "yaml";

import type { EnvClientReadOpts } from "../types";
import type { IEnvClientStrategy } from "./types";

export class SopsEnvClientStrategy implements IEnvClientStrategy {
  /**
   * __NOTE: Only yaml files are currently supported.__
   *
   * @example
   * ```yaml
   *  GITHUB_APP_ID: abc123
   *  GITHUB_INSTALLATION_ID: abc123
   *  GITHUB_PEM_CONTENT: abc123
   * ```
   */
  async readFromEnv(
    fileName: string,
    opts?: EnvClientReadOpts,
  ): Promise<Map<string, string>> {
    const { baseDir = "" } = opts ?? {};

    if (!fileName.endsWith("yaml")) {
      throw new Error("Only yaml files are currently supported");
    }
    const loaded = new Map<string, string>();

    const path = baseDir ? `${baseDir}/${fileName}` : `${fileName}`;
    const envFile = Bun.file(path);
    if (!(await envFile.exists())) {
      console.warn(`Warning: ${envFile.name} not found`);
      return loaded;
    }

    console.log(`Loading ${envFile.name}`);

    const content = await $`sops decrypt ${path}`.text();
    const parsed = yaml.parse(content) as Record<string, unknown> | null;

    if (!parsed || Array.isArray(parsed)) {
      throw new Error(
        `Expected ${envFile.name} to decrypt to a root-level YAML object.`,
      );
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        throw new Error(
          `Expected ${envFile.name} key \`${key}\` to contain a string value.`,
        );
      }

      loaded.set(key, value);
    }

    return loaded;
  }
}
