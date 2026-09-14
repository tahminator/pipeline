import type { IProtobufTargetLanguageStrategy } from "./types";

export class RustProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "rust";
  readonly remotePlugin = "buf.build/community/neoeinstein-prost";
}
