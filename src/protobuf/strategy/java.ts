import type { IProtobufTargetLanguageStrategy } from "./types";

import {
  DEFAULT_PROTOBUF_JAVA_VERSION,
  javaGeneratorVersion,
} from "../versions";

export class JavaProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "java";
  readonly remotePlugin: string;

  constructor(runtimeVersion = DEFAULT_PROTOBUF_JAVA_VERSION) {
    this.remotePlugin = `buf.build/protocolbuffers/java:v${javaGeneratorVersion(runtimeVersion)}`;
  }
}
