import { $ } from "bun";

import { Utils } from "../utils";

export class NPMClient {
  private constructor(private readonly npmToken?: string) {}

  /**
   * Create NPMClient using an `npmToken` if passed in or OIDC / [Trusted Publishing](https://docs.npmjs.com/trusted-publishers).
   *
   * __It is recommended that you use [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) now.__ Using tokens
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
  static async create(npmToken?: string): Promise<NPMClient> {
    if (npmToken) {
      await $`npm config set //registry.npmjs.org/:_authToken=${npmToken}`;
    }
    return new this(npmToken);
  }

  /**
   * @note You must ensure that the current root directory `package.json`
   * is filled out with the name of the package and the version you would like to
   * deploy.
   */
  async publish(dryRun?: boolean) {
    const dryRunFlag = dryRun ? ["--dry-run"] : [];

    if (Utils.Log.isDebug) {
      console.log(await $`ls .`.text());
      console.log(await $`ls ./dist/`.text());
      console.log(await $`pwd`.text());
      console.log(await $`cat ./package.json`.text());
    }

    const provenanceFlag = this.npmToken ? [] : ["--provenance"];

    await $`npm publish --access public ${provenanceFlag} ${dryRunFlag} ./`;
    console.log("Package has been successfully published");
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    if (this.npmToken) {
      await $`npm logout`;
    }
  }
}
