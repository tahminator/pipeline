export enum EnvClientStrategy {
  GIT_CRYPT = 0,
  SOPS = 1,
}

export interface EnvClientReadOpts {
  baseDir?: string;
}
