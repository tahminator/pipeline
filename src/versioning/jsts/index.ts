import type { IJavascriptPackageJsonVersioningClient } from "../types";

import { BaseVersioningClient } from "../base";

export class JavascriptPackageJsonVersioningClient
  extends BaseVersioningClient
  implements IJavascriptPackageJsonVersioningClient
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
