import { Octokit } from "@octokit/rest";

import { GitHubOutputManager } from "./output";
import { GitHubPRManager } from "./pr";
import { GitHubTagManager } from "./tag";

export class GitHubClient {
  private readonly client: Octokit;
  private readonly isExplicitToken: boolean;

  private readonly tagManager: GitHubTagManager;
  private readonly outputManager: GitHubOutputManager;
  private readonly prManager: GitHubPRManager;

  constructor(ghToken?: string) {
    this.isExplicitToken = !!ghToken;
    const token = ghToken ?? process.env.GH_TOKEN;
    if (!token) {
      throw new Error(
        "No GitHub token has been provided & GH_TOKEN cannot be found in environment",
      );
    }

    this.client = new Octokit({
      auth: token,
    });

    this.tagManager = new GitHubTagManager(this.client, this.isExplicitToken);
    this.outputManager = new GitHubOutputManager();
    this.prManager = new GitHubPRManager(this.client);
  }

  createTag(...args: Parameters<typeof this.tagManager.createTag>) {
    return this.tagManager.createTag(...args);
  }

  outputToGithubOutput(
    ...args: Parameters<typeof this.outputManager.outputToGithubOutput>
  ) {
    return this.outputManager.outputToGithubOutput(...args);
  }

  updateK8sTagWithPR(
    ...args: Parameters<typeof this.prManager.updateK8sTagWithPR>
  ) {
    return this.prManager.updateK8sTagWithPR(...args);
  }
}
