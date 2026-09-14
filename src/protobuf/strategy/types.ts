export interface ProtobufGeneratorPlugin {
  readonly remote: string;
  readonly opt?: string[];
}

export interface IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName: string;
  readonly plugins: ProtobufGeneratorPlugin[];
}
