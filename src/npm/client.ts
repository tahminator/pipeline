import { $ } from "bun";

import { Utils } from "../utils";

export class NPMClient {
  private constructor() {}

  static async create(npmToken: string): Promise<NPMClient> {
    await $`npm config set //registry.npmjs.org/:_authToken=${npmToken}`;
    return new this();
  }

  /**
   * @note You must ensure that the current root directory `package.json`
   * is filled out with the name of the package and the version you would like to
   * deploy.
   */
  async publish(
    dryRun?: boolean,
    debugOpts?: {
      scopeName: string;
    },
  ) {
    if (Utils.Log.isDebug) {
      Utils.Log.debugLog(await $`npm whoami`);
      if (debugOpts && debugOpts.scopeName) {
        Utils.Log.debugLog(
          await $`npm access ls-packages ${debugOpts?.scopeName}`,
        );
      }
    } else {
      console.log("debug skipped");
    }

    const dryRunFlag = dryRun ? "--dry-run" : "";

    await $`npm publish --access public ${dryRunFlag}`;
    console.log("Package has been successfully published");
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    await $`npm logout`;
  }
}
