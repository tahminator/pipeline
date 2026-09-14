import type { IProtobufTargetLanguageStrategy } from "./types";

export class JavaProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "java";
  readonly remotePlugin = "buf.build/protocolbuffers/java";
}
