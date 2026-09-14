import type { IProtobufTargetLanguageStrategy } from "./types";

export class GoProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "go";
  readonly remotePlugin = "buf.build/protocolbuffers/go";
}
