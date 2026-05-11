import semver from "semver";

import type { GitHubClient } from "../gh";

import {
  VersionUpdatingStrategy,
  type IVersioningClient,
  type IVersionUpdatingClient,
} from "./types";
import { JavaMavenVersioningClient } from "./updating/java/maven";
import { JavascriptPackageJsonVersioningClient } from "./updating/jsts";

export class VersioningClient implements IVersioningClient {
  private static readonly INITIAL_VERSION = "1.0.0";

  private readonly delegate: IVersionUpdatingClient;

  constructor(
    private readonly githubClient: GitHubClient,
    strategy: VersionUpdatingStrategy,
  ) {
    this.delegate = this.getDelegate(strategy);
  }

  private getDelegate(strategy: VersionUpdatingStrategy) {
    switch (strategy) {
      case VersionUpdatingStrategy.JSTS:
        return new JavascriptPackageJsonVersioningClient();
      case VersionUpdatingStrategy.JAVA_MAVEN:
        return new JavaMavenVersioningClient();
    }
  }

  private parseOrThrow(label: string, v: string) {
    const s = semver.parse(v);
    if (!s) {
      throw new Error(`${label} is not valid semver`);
    }
    return s;
  }

  async update(version: string): Promise<void> {
    await this.delegate.update(version);
  }

  /**
   * generate next version tag.
   *
   * If `baseVersion` is not passed in:
   * - if the repository has no tags yet, it will return `1.0.0`
   * - otherwise, it will bump the latest tag's patch number
   *
   * if `baseVersion` is passed in, it will consult the github client and do the following:
   *
   * - if the github client reports a latest tag with the same `MAJOR` and `MINOR` version as `baseVersion`, it will just bump `PATCH` number
   * - if the github client reports a latest tag with a lower `MAJOR` and `MINOR` version than `baseVersion`, it will match `baseVersion`'s `MAJOR` & `MINOR`. __It will NOT bump `PATCH` number.__
   *
   * `baseVersion` must set patch number to `0`. (e.g. `1.0.0`, `1.5.0`, `2.0.0`, etc.)
   */
  async next(
    baseVersion?: string,
    ...opts: Parameters<GitHubClient["getLatestTag"]>
  ): Promise<string> {
    const latestTag = await this.githubClient.getLatestTag(...opts);

    if (!baseVersion) {
      if (!latestTag) {
        return VersioningClient.INITIAL_VERSION;
      } else {
        const latestSemver = this.parseOrThrow(
          "latest tag from github",
          latestTag,
        );
        return latestSemver.inc("patch").toString();
      }
    }

    const baseVersionSemver = this.parseOrThrow("baseVersion", baseVersion);
    if (baseVersionSemver.patch !== 0) {
      throw new Error("baseVersion has a non-zero patch number.");
    }

    if (!latestTag) {
      return baseVersionSemver.inc("patch").toString();
    }

    const latestSemver = this.parseOrThrow("latest tag from github", latestTag);

    if (
      latestSemver.major === baseVersionSemver.major &&
      latestSemver.minor === baseVersionSemver.minor
    ) {
      return latestSemver.inc("patch").toString();
    }

    return baseVersionSemver.toString();
  }

  /**
   * generate next beta version tag using a `sha`.
   *
   * simply finds latest version from github and generates `{version}-beta.{sha}` to it.
   *
   * for example, `1.3.2-beta.58cf28bd`
   */
  async nextBeta(
    sha: string,
    ...opts: Parameters<GitHubClient["getLatestTag"]>
  ): Promise<string> {
    const latestTag = await this.githubClient.getLatestTag(...opts);

    if (!latestTag) {
      throw new Error(
        "You must upload a tag atleast once before generating a beta tag.",
      );
    }

    const latest = this.parseOrThrow("latest tag from github", latestTag);

    return `${latest.toString()}-beta.${sha}`;
  }
}
