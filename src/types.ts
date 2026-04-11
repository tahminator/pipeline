export type Environment = "staging" | "production";

export type OwnerString = string;
export type RepoString = string;

export type LiteralUnion<T extends string> = T | (string & {});
