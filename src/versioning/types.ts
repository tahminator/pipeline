export enum VersioningStrategy {
  JSTS = 0,
  JAVA_MAVEN = 1,
}

export interface IVersioningClient {
  update(version: string): Promise<void>;
}

export interface IJavascriptPackageJsonVersioningClient extends IVersioningClient {}
export interface IJavaMavenVersioningClient extends IVersioningClient {}
