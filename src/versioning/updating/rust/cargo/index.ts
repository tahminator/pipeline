import type { IRustCargoVersionUpdatingClient } from "../../../types";

import { BaseVersionUpdatingClient } from "../../base";

export class RustCargoVersioningClient
  extends BaseVersionUpdatingClient
  implements IRustCargoVersionUpdatingClient
{
  async update(version: string): Promise<void> {
    const files = await this.findFiles("**/Cargo.toml");

    for (const fileLocation of files) {
      const file = Bun.file(fileLocation);
      const oldCargoToml = await file.text();
      const newCargoToml = this.updatePackageVersionInCargoToml(
        oldCargoToml,
        version,
      );

      if (!newCargoToml) {
        continue;
      }

      await Bun.write(fileLocation, newCargoToml);
      this.logFileLocationUpdated(fileLocation, version);
    }
  }

  private updatePackageVersionInCargoToml(
    cargoToml: string,
    version: string,
  ): string | null {
    const lines = cargoToml.split("\n");
    let insidePackageSection = false;
    let packageSectionFound = false;
    let packageVersionLineIndex = -1;

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line) continue;

      const sectionMatch = line.match(/^\s*\[(.+)\]\s*$/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1]?.trim();
        insidePackageSection = sectionName === "package";
        if (insidePackageSection) {
          packageSectionFound = true;
        }
        continue;
      }

      if (!insidePackageSection) continue;
      if (/^\s*version(?:\.[A-Za-z0-9_-]+)?\s*=/.test(line)) {
        packageVersionLineIndex = index;
        break;
      }
    }

    if (!packageSectionFound) {
      return null;
    }

    if (packageVersionLineIndex === -1) {
      throw new Error(
        "Can't find version key inside of package section in Cargo.toml",
      );
    }

    lines[packageVersionLineIndex] = `version = "${version}"`;
    return `${lines.join("\n").replace(/\n*$/, "\n")}`;
  }
}
