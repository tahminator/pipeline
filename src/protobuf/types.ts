export enum ProtobufCompilerBackend {
  ARTIFACT_KEEPER = 0,
}

export enum ProtobufSourceLanguage {
  RUST = 0,
}

export enum ProtobufTargetLanguage {
  JAVA = 0,
  RUST = 1,
  GO = 2,
}

export interface ProtobufArtifactKeeperBackend {
  type: ProtobufCompilerBackend.ARTIFACT_KEEPER;
  url: string;
  username: string;
  token: string;
}

export type ProtobufCompilerBackendConfig = ProtobufArtifactKeeperBackend;

export interface ProtobufJavaTargetLanguageOptions {
  /** Maven/Gradle publishing group; Java packages are configured in .proto files. */
  groupId: string;
  artifactId: string;
  version: string;
  buildTool?: "maven" | "gradle";
  /** Exact stable Java runtime version; also pins the matching Buf generator. Defaults to 4.32.1. */
  protobufJavaVersion?: string;
}

export interface ProtobufRustTargetLanguageOptions {
  crateName: string;
  version: string;
  /** Prost runtime constraint within 0.14; matched to the pinned Prost/Tonic generators. */
  prostVersion?: string;
}

/** Go import paths are configured with go_package in .proto files. */
export interface ProtobufGoTargetLanguageOptions {
  version: string;
}

export type ProtobufTargetLanguageOptions =
  | ProtobufGoTargetLanguageOptions
  | ProtobufJavaTargetLanguageOptions
  | ProtobufRustTargetLanguageOptions;

export type ProtobufTargetLanguages = {
  [ProtobufTargetLanguage.JAVA]?: ProtobufJavaTargetLanguageOptions;
  [ProtobufTargetLanguage.RUST]?: ProtobufRustTargetLanguageOptions;
  [ProtobufTargetLanguage.GO]?: ProtobufGoTargetLanguageOptions;
};

export interface ProtobufCompilerCompileArgs {
  /** All targets are published through this one backend. */
  backend?: ProtobufCompilerBackendConfig;
  sourceLanguage: ProtobufSourceLanguage;
  /** Optional Buf token for private module inputs. Code generation uses local plugins. */
  bufToken?: string;
  targetLanguages: ProtobufTargetLanguages;
  /** Directory containing proto files, or one specific `.proto` file. */
  protoFilesLocation: string;
  /** Defaults to a temporary directory. */
  outputDirectory?: string;
}

export interface ProtobufCompilerCompileResult {
  outputDirectory: string;
  generatedDirectories: Partial<Record<ProtobufTargetLanguage, string>>;
}
