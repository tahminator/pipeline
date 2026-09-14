import type {
  ProtobufTargetLanguage,
  ProtobufTargetLanguageOptions,
} from "../types";

export interface ProtobufCompilerBackendPublishArgs {
  generatedDirectory: string;
  targetLanguage: ProtobufTargetLanguage;
  options: ProtobufTargetLanguageOptions;
}

export interface IProtobufCompilerBackendStrategy {
  publish(args: ProtobufCompilerBackendPublishArgs): Promise<void>;
}
