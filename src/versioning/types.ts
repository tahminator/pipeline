export enum VersionUpdatingStrategy {
  JSTS = 0,
  JAVA_MAVEN = 1,
  NONE = 2,
}

export interface IVersionUpdatingClient {
  update(version: string): Promise<void>;
}

export interface IVersioningClient extends IVersionUpdatingClient {
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
  next(baseVersion?: string): Promise<string>;

  /**
   * generate next beta version tag.
   *
   * simply finds latest version from github and generates `{version}-beta.{sha}` to it.
   *
   * @note you may pass in the first 8 characters of `sha` if you choose.
   *
   * for example, `1.3.2-beta.58cf28bd`
   */
  nextBeta(sha: string): Promise<string>;
}

export interface IJavascriptPackageJsonVersionUpdatingClient extends IVersionUpdatingClient {}
export interface IJavaMavenVersionUpdatingClient extends IVersionUpdatingClient {}
