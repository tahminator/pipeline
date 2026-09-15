import type { IProtobufTargetLanguageStrategy } from "./types";

export class GoProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "go";
  readonly requiredCommands = ["protoc-gen-go", "protoc-gen-go-grpc"];
  readonly plugins = [
    { local: "protoc-gen-go" },
    { local: "protoc-gen-go-grpc" },
  ];
}
