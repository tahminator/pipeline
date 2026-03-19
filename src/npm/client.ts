import { $ } from "bun";

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
  async publish() {
    await $`npm publish --access public`;
    console.log("Package has been successfully published");
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    await $`npm logout`;
  }
}
