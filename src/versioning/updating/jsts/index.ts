import type { IJavascriptPackageJsonVersionUpdatingClient } from "../../types";

import { BaseVersionUpdatingClient } from "../base";

export class JavascriptPackageJsonVersioningClient
  extends BaseVersionUpdatingClient
  implements IJavascriptPackageJsonVersionUpdatingClient
{
  async update(version: string): Promise<void> {
    const files = await this.findFiles(
      "**/package.json",
      /(^|\/)node_modules\//,
    );

    for (const fileLocation of files) {
      const file = Bun.file(fileLocation);

      const pkg = await file.json();
      pkg.version = version;

      await Bun.write(fileLocation, JSON.stringify(pkg, null, 2) + "\n");

      this.logFileLocationUpdated(fileLocation, version);
    }
  }
}
