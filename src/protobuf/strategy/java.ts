import type { IProtobufTargetLanguageStrategy } from "./types";

import {
  DEFAULT_PROTOBUF_JAVA_VERSION,
  GRPC_JAVA_VERSION,
  javaGeneratorVersion,
} from "../versions";

export class JavaProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "java";
  readonly plugins;

  constructor(runtimeVersion = DEFAULT_PROTOBUF_JAVA_VERSION) {
    this.plugins = [
      {
        remote: `buf.build/protocolbuffers/java:v${javaGeneratorVersion(runtimeVersion)}`,
      },
      { remote: `buf.build/grpc/java:v${GRPC_JAVA_VERSION}` },
    ];
  }
}
