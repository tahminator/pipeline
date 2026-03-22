import { $ } from "bun";

import { Colors } from "./colors";
import { getEnvVariables } from "./env";
import { Log } from "./log";
import { generateShortId } from "./short";

export class Utils {
  // hoist
  static Colors = Colors;
  static Log = Log;

  static getEnvVariables(...args: Parameters<typeof getEnvVariables>) {
    return getEnvVariables(...args);
  }

  static generateShortId(...args: Parameters<typeof generateShortId>) {
    return generateShortId(...args);
  }

  static async updateAllPackageJsonsWithVersion(
    version: string,
  ): Promise<void> {
    const files = (
      await $`find . -name "package.json" -not -path "*/node_modules/*"`.text()
    )
      .trim()
      .split("\n");

    for (const fileLocation of files) {
      const file = Bun.file(fileLocation);

      const pkg = await file.json();
      pkg.version = version;

      await Bun.write(fileLocation, JSON.stringify(pkg, null, 2) + "\n");

      console.log(
        `Successfully updated version in ${fileLocation} to ${version}`,
      );
    }
  }
}
