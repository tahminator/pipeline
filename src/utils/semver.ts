import semver from "semver";

export class SemVer {
  static validate(version: string | semver.SemVer): boolean {
    return semver.valid(version) != null;
  }
}
