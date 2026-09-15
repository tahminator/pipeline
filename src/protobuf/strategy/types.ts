export type ProtobufGeneratorPlugin =
  | {
      readonly remote: string;
      readonly opt?: string[];
    }
  | {
      readonly local: string;
      readonly opt?: string[];
    }
  | {
      readonly protoc_builtin: string;
      readonly opt?: string[];
    };

export interface IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName: string;
  readonly plugins: ProtobufGeneratorPlugin[];
  readonly requiredCommands?: readonly string[];
}
