import type { IVersioningClient } from "./types";

export abstract class BaseVersioningClient implements IVersioningClient {
  abstract update(version: string): Promise<void>;

  protected logFileLocationUpdated(fileLocation: string, version: string) {
    console.log(
      `Successfully updated version in ${fileLocation} to ${version}`,
    );
  }

  protected async findFiles(filePattern: string, pathExclusionRegex?: RegExp) {
    const glob = new Bun.Glob(filePattern);
    const files: string[] = [];
    for await (const file of glob.scan(".")) {
      if (pathExclusionRegex && pathExclusionRegex.test(file)) {
        continue;
      }
      files.push(file);
    }
    return files;
  }
}
