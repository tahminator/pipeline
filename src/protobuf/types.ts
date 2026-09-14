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
  protobufJavaVersion?: string;
}

export interface ProtobufRustTargetLanguageOptions {
  crateName: string;
  version: string;
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
  /** Optional BSR API token used for Buf remote plugins. */
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
