import semver from "semver";

import type { IProtobufTargetLanguageStrategy } from "./types";

import { DEFAULT_PROST_VERSION } from "../versions";

export class RustProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "rust";
  readonly requiredCommands = ["protoc-gen-prost", "protoc-gen-tonic"];
  readonly plugins = [
    { local: "protoc-gen-prost" },
    {
      local: "protoc-gen-tonic",
      /*
       * Do not let Tonic include Prost files.
       * src/lib.rs includes messages and services in one module.
       */
      opt: ["no_include=true"],
    },
  ];

  constructor(prostVersion = DEFAULT_PROST_VERSION) {
    if (
      !semver.validRange(prostVersion) ||
      !semver.subset(prostVersion, ">=0.14.0 <0.15.0")
    ) {
      throw new Error(
        "The pinned Rust gRPC generators require prostVersion in the 0.14 release series.",
      );
    }
  }
}
