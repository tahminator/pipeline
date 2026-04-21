import { $ } from "bun";

import { Utils } from "../utils";

export class NPMClient {
  private constructor() {}

  /**
   * __You must use [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) now.__ Using tokens
   * now are extremely flaky and should be avoided.
   *
   * __NOTE: Base yaml must have this property__
   *
   * @example
   * ```yaml
   *  permissions:
   *    id-token: write  # Required for OIDC
   * ```
   */
  static async create(): Promise<NPMClient> {
    // await $`npm config set //registry.npmjs.org/:_authToken=${npmToken}`;
    return new this();
  }

  /**
   * @note You must ensure that the current root directory `package.json`
   * is filled out with the name of the package and the version you would like to
   * deploy.
   */
  async publish(dryRun?: boolean, publishBetaTag?: boolean) {
    const dryRunFlag = dryRun ? ["--dry-run"] : [];
    const tagFlag = publishBetaTag ? ["--tag", "beta"] : [];

    if (Utils.Log.isDebug) {
      console.log(await $`ls .`.text());
      console.log(await $`ls ./dist/`.text());
      console.log(await $`pwd`.text());
      console.log(await $`cat ./package.json`.text());
    }

    await $`npm publish --access public --provenance ${tagFlag} ${dryRunFlag} ./`;
    console.log("Package has been successfully published");
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    // await $`npm logout`;
  }
}
