import type { IProtobufTargetLanguageStrategy } from "./types";

export class GoProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "go";
  readonly plugins = [
    { remote: "buf.build/protocolbuffers/go:v1.36.11" },
    { remote: "buf.build/grpc/go:v1.5.1" },
  ];
}
