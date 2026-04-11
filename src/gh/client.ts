import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

import { GitHubOutputManager } from "./output";
import { GitHubPRManager } from "./pr";
import { GitHubTagManager } from "./tag";

export class GitHubClient {
  private readonly tagManager: GitHubTagManager;
  private readonly outputManager: GitHubOutputManager;
  private readonly prManager: GitHubPRManager;

  private constructor(
    private readonly client: Octokit,
    private readonly isExplicitToken: boolean,
  ) {
    this.tagManager = new GitHubTagManager(this.client, this.isExplicitToken);
    this.outputManager = new GitHubOutputManager();
    this.prManager = new GitHubPRManager(this.client);
  }

  /**
   * @note `appId` can be `Client ID` or `App ID`. Hover over `appId` for more details.
   */
  static async createWithGithubAppToken({
    appId,
    privateKey,
    installationId,
  }: {
    /**
     * get it from https://github.com/settings/apps/<appName> -> `Client ID` or `App ID`
     */
    appId: string;
    privateKey: string;
    /**
     * get it from github.com/settings/installations/<installationId>
     */
    installationId: string;
  }) {
    return new this(
      new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId,
          privateKey,
          installationId,
        },
      }),
      true,
    );
  }

  /**
   * __It is highly recommended that you use `createWithGithubAppToken`, unless you need the "dumb"
   * features of this client such as, for example, outputting data to `$GITHUB_ENV`__
   *
   * This is because the default CI token is not eligible for any automation whatsoever. That includes triggering
   * CI based off pushes, merges, or anything else of the like.
   */
  static async createWithDefaultCiToken() {
    const token = process.env.GH_TOKEN;
    if (!token) {
      throw new Error("GH_TOKEN cannot be found in environment");
    }

    return new this(
      new Octokit({
        auth: token,
      }),
      false,
    );
  }

  /**
   * @deprecated use `createWithGithubAppToken`
   */
  static async createWithPatCiToken(pat: string) {
    return new this(
      new Octokit({
        auth: pat,
      }),
      true,
    );
  }

  createTag(...args: Parameters<GitHubTagManager["createTag"]>) {
    return this.tagManager.createTag(...args);
  }

  outputToGithubOutput(
    ...args: Parameters<GitHubOutputManager["outputToGithubOutput"]>
  ) {
    return this.outputManager.outputToGithubOutput(...args);
  }

  updateK8sTagWithPR(
    ...args: Parameters<GitHubPRManager["updateK8sTagWithPR"]>
  ) {
    return this.prManager.updateK8sTagWithPR(...args);
  }

  sendPrMessage(...args: Parameters<GitHubPRManager["sendPrMessage"]>) {
    return this.prManager.sendPrMessage(...args);
  }
}
