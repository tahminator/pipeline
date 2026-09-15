import semver from "semver";

import type { IProtobufTargetLanguageStrategy } from "./types";

import { DEFAULT_PROTOBUF_JAVA_VERSION } from "../versions";

export class JavaProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "java";
  readonly requiredCommands = ["protoc-gen-grpc-java"];
  readonly plugins = [
    { protoc_builtin: "java" },
    { local: "protoc-gen-grpc-java" },
  ];

  constructor(runtimeVersion = DEFAULT_PROTOBUF_JAVA_VERSION) {
    const version = semver.parse(runtimeVersion);
    if (
      !version ||
      ![3, 4].includes(version.major) ||
      version.prerelease.length > 0 ||
      version.build.length > 0
    ) {
      throw new Error("protobufJavaVersion must be an exact stable version.");
    }
  }
}
