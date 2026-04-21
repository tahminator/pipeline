import { $ } from "bun";

import { decodeBase64EncodedString } from "./b64";
import { isCmdAvailable } from "./cmd";
import { Colors } from "./colors";
import { Log } from "./log";
import { SemVer } from "./semver";
import { generateShortId } from "./short";

export class Utils {
  // hoist
  static Colors = Colors;
  static Log = Log;
  static SemVer = SemVer;

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

  static async isCmdAvailable(...args: Parameters<typeof isCmdAvailable>) {
    return isCmdAvailable(...args);
  }

  static async decodeBase64EncodedString(
    ...args: Parameters<typeof decodeBase64EncodedString>
  ) {
    return decodeBase64EncodedString(...args);
  }
}
