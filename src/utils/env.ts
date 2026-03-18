import { $ } from "bun";

type Opts = {
  baseDir?: string;
  mask_PLZ_DO_NOT_TURN_OFF_UNLESS_YOU_KNOW_WHAT_UR_DOING?: boolean;
};

// TODO: replace with a more robust solution
let isGitCryptUnlocked = false;

/**
 * Load environment variables from encrypted `.env.*` files. This method will call `git-crypt unlock` for you if necessary.
 *
 * @param environments - List of environment files to load.
 *
 * @param opts - Optional overrides
 * @param opts.baseDir - Directory of environment variable. Defaults to the root directory / ""
 * @param opts.mask_PLZ_DO_NOT_TURN_OFF_UNLESS_YOU_KNOW_WHAT_UR_DOING - Should variables be masked. Defaults to `true`. __NOTE: This will only work in a GitHub Action runner.__
 *
 * @returns a map of the loaded environments as a key and value inside of a map.
 *
 * @note _Please note that duplicate environment variables will be overwritten, so
 * the order in which you define `environments` does matter._
 */
export async function getEnvVariables(
  environments: string[],
  opts?: Opts,
): Promise<Record<string, string>> {
  const {
    baseDir = "",
    mask_PLZ_DO_NOT_TURN_OFF_UNLESS_YOU_KNOW_WHAT_UR_DOING = true,
  } = opts ?? {};
  if (!isGitCryptUnlocked) {
    await $`git-crypt unlock`.nothrow();
    isGitCryptUnlocked = true;
  }

  const loaded = new Map<string, string>();

  for (const env of environments) {
    const path = baseDir ? `${baseDir}/.env.${env}` : `.env.${env}`;
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
  }

  if (mask_PLZ_DO_NOT_TURN_OFF_UNLESS_YOU_KNOW_WHAT_UR_DOING) {
    for (const [varName, value] of loaded.entries()) {
      if (value === "true" || value === "false" || value === "") {
        console.log(`Not masking ${varName}: true/false/empty value`);
        continue;
      }

      console.log(`Masking ${varName}`);
      console.log(`::add-mask::${value}`);
    }
  }

  return Object.fromEntries(loaded);
}
