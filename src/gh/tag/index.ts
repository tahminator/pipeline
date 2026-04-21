import { Octokit } from "@octokit/rest";
import { $ } from "bun";
import semver from "semver";

import type { OwnerString, RepoString } from "../../types";

export class GitHubTagManager {
  static readonly BASE_VERSION = "1.0.0";

  constructor(
    private readonly client: Octokit,
    private readonly isExplicitToken: boolean,
  ) {}

  private checkToken(): void {
    if (!this.isExplicitToken) {
      throw new Error(
        "You must pass in an explicit GitHub token for this operation. You may either use a PAT or a GitHub App Token",
      );
    }
  }

  /**
   * Returns the latest stable semver tag in the repository.
   */
  async getLatestTag({
    repositoryOverride,
  }: {
    repositoryOverride?: [OwnerString, RepoString];
  } = {}): Promise<string | null> {
    const [owner, repo] = this.parseRepository(repositoryOverride);

    const { data: tags } = await this.client.rest.repos.listTags({
      owner,
      repo,
    });

    return (
      tags
        .map((t) => t.name)
        .filter((tag) => {
          const parsed = semver.parse(tag);
          return parsed && parsed.prerelease.length === 0;
        })
        .sort(semver.rcompare)[0] ?? null
    );
  }

  /**
   * Utilizes the GitHub API to create a new tag version in the given repository.
   *
   * @note You **must** pass in a GitHub token because the regular Github bot token
   * cannot trigger actions (due to fear of recursion). You must either provide a GitHub App token or
   * a GitHub PAT.
   */
  async createTag({
    repositoryOverride,
    releaseType,
    onPreTagCreate,
  }: {
    repositoryOverride?: [OwnerString, RepoString];
    releaseType?: semver.ReleaseType;
    onPreTagCreate?: (tag: string) => Promise<void>;
  }): Promise<void> {
    this.checkToken();

    const [owner, repo] = this.parseRepository(repositoryOverride);

    const lastTag = await this.getLatestTag({
      repositoryOverride: [owner, repo],
    });

    const nextTag =
      lastTag ?
        semver.inc(lastTag, releaseType ?? "patch")
      : GitHubTagManager.BASE_VERSION;

    if (!nextTag) {
      throw new Error("Could not increment version");
    }

    const { data: repository } = await this.client.rest.repos.get({
      owner,
      repo,
    });

    const { data: branch } = await this.client.rest.repos.getBranch({
      owner,
      repo,
      branch: repository.default_branch,
    });

    if (onPreTagCreate) {
      await onPreTagCreate?.(nextTag);
    }

    const { stdout } = await $`git status --porcelain`.quiet();
    const changedFiles = stdout
      .toString()
      .split("\n")
      .map((line) => line.slice(3).trim())
      .filter(Boolean);

    const sha = await this.createBlob({
      owner,
      repo,
      changedFiles,
      baseSha: branch.commit.commit.tree.sha,
    });

    const { data: commit } = await this.client.rest.git.createCommit({
      owner,
      repo,
      message: `${nextTag}`,
      tree: sha,
      parents: [branch.commit.sha],
    });

    await this.client.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${nextTag}`,
      sha: commit.sha,
    });
  }

  private parseRepository(repositoryOverride: [string, string] | undefined) {
    if (repositoryOverride) {
      return [repositoryOverride[0], repositoryOverride[1]] as [
        OwnerString,
        RepoString,
      ];
    }

    const repositoryEnv = (() => {
      const v = process.env.GITHUB_REPOSITORY;
      return v;
    })();

    if (!repositoryEnv) {
      throw new Error(
        "GITHUB_REPOSITORY not found in environment and no explicit github repository override defined",
      );
    }

    return repositoryEnv.split("/") as [OwnerString, RepoString];
  }

  private async createBlob({
    owner,
    repo,
    baseSha,
    changedFiles,
  }: {
    owner: string;
    repo: string;
    baseSha: string;
    changedFiles: string[];
  }): Promise<string> {
    if (!changedFiles.length) {
      return baseSha;
    }

    const treeEntries = await Promise.all(
      changedFiles.map(async (filePath) => {
        const content = await Bun.file(filePath).text();
        const { data: blob } = await this.client.rest.git.createBlob({
          owner,
          repo,
          content,
          encoding: "utf-8",
        });
        return {
          path: filePath,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      }),
    );

    const { data: newTree } = await this.client.rest.git.createTree({
      owner,
      repo,
      base_tree: baseSha,
      tree: treeEntries,
    });

    return newTree.sha;
  }
}
