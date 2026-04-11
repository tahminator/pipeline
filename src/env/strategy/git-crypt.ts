import { $ } from "bun";

import type { EnvClientReadOpts } from "../types";
import type { IEnvClientStrategy } from "./types";

export class GitCryptEnvClientStrategy implements IEnvClientStrategy {
  // TODO: replace with a more robust solution
  isGitCryptUnlocked = false;

  constructor() {}

  async readFromEnv(
    fileName: string,
    opts?: EnvClientReadOpts,
  ): Promise<Map<string, string>> {
    const { baseDir = "" } = opts ?? {};

    if (!this.isGitCryptUnlocked) {
      await $`git-crypt unlock`.nothrow();
      this.isGitCryptUnlocked = true;
    }

    const loaded = new Map<string, string>();

    const path = baseDir ? `${baseDir}/${fileName}` : `${fileName}`;
    const envFile = Bun.file(path);
    if (await envFile.exists()) {
      console.log(`Loading ${envFile.name}`);

      const content = await envFile.text();
      const lines = content.split("\n").filter((s) => s.length > 0);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const match = (() => {
          const [key, ...rest] = trimmed.split("=");
          return [key, rest.join("=")];
        })();
        if (match.length === 2) {
          const [key, value] = match as [string, string];
          const cleanKey = key.trim();
          let cleanValue = value.trim();
          if (
            (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
          ) {
            cleanValue = cleanValue.slice(1, -1);
          }

          loaded.set(cleanKey, cleanValue);
        }
      }
    } else {
      console.warn(`Warning: ${envFile.name} not found`);
    }

    return loaded;
  }
}
