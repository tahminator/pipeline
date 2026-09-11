import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

import { GitHubOutputManager } from "./output";
import { GitHubPRManager } from "./pr";
import { GitHubTagManager } from "./tag";
import { GitHubTeamManager } from "./team";

export class GitHubClient {
  private readonly tagManager: GitHubTagManager;
  private readonly outputManager: GitHubOutputManager;
  private readonly prManager: GitHubPRManager;
  private readonly teamManager: GitHubTeamManager;

  private constructor(
    private readonly client: Octokit,
    private readonly isExplicitToken: boolean,
  ) {
    this.tagManager = new GitHubTagManager(this.client, this.isExplicitToken);
    this.outputManager = new GitHubOutputManager();
    this.prManager = new GitHubPRManager(this.client);
    this.teamManager = new GitHubTeamManager(this.client);
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

  /**
   * Utilizes the GitHub API to create a new tag version in the given repository.
   *
   * @note You **must** pass in a GitHub token because the regular Github bot token
   * cannot trigger actions (due to fear of recursion). You must either provide a GitHub App token or
   * a GitHub PAT.
   *
   * @note you should use `VersioningClient` to generate `nextTag`
   */
  createTag(...args: Parameters<GitHubTagManager["createTag"]>) {
    return this.tagManager.createTag(...args);
  }

  /**
   * Returns the latest stable semver tag in the repository.
   */
  getLatestTag(...args: Parameters<GitHubTagManager["getLatestTag"]>) {
    return this.tagManager.getLatestTag(...args);
  }

  /**
   * Write an output back to Github Actions in order to re-use / pass
   * data between steps, jobs, etc.
   *
   * @see documentation for passing outputs between jobs [here](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs)
   */
  outputToGithubOutput(
    ...args: Parameters<GitHubOutputManager["outputToGithubOutput"]>
  ) {
    return this.outputManager.outputToGithubOutput(...args);
  }

  /**
   *
   * update k8s manifest repo with new tag version.
   *
   * @note `kustomizationFile` must look like this:
   *
   * ```yaml
   * apiVersion: kustomize.config.k8s.io/v1beta1
   * kind: Kustomization
   * resources:
   *   - deployment.yaml
   *   - secrets.yaml
   *   - service.yaml
   *   - monitor.yaml
   * commonLabels:
   *   app: instalock-web
   *   environment: production
   * # This part specifically
   * images:
   *   - name: tahminator/instalock-web
   *     newTag: a70ee0e
   * ```
   */
  updateK8sTagWithPR(
    ...args: Parameters<GitHubPRManager["updateK8sTagWithPR"]>
  ) {
    return this.prManager.updateK8sTagWithPR(...args);
  }

  sendPrMessage(...args: Parameters<GitHubPRManager["sendPrMessage"]>) {
    return this.prManager.sendPrMessage(...args);
  }

  /**
   * @note if the PR doesn't exist yet, just use `updateK8sTagWithPR` instead, since it
   * creates the PR with the necessary changes and merges it for you in one call.
   */
  mergePr(...args: Parameters<GitHubPRManager["mergePr"]>) {
    return this.prManager.mergePr(...args);
  }

  /**
   * Create, update, or get a check run (the "status checks" shown on a PR/commit), dispatched
   * by `args.action`.
   */
  statusCheck(...args: Parameters<GitHubPRManager["statusCheck"]>) {
    return this.prManager.statusCheck(...args);
  }

  /**
   * Confirms whether the given user is an active member of a team within an org.
   *
   * @note this only returns `true` for `active` memberships. A user with a `pending`
   * invite (has not accepted yet) will return `false`.
   */
  isTeamMember(...args: Parameters<GitHubTeamManager["isTeamMember"]>) {
    return this.teamManager.isTeamMember(...args);
  }
}
