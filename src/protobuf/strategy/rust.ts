import semver from "semver";

import type { IProtobufTargetLanguageStrategy } from "./types";

import { DEFAULT_PROST_VERSION, PROST_PLUGIN_VERSION } from "../versions";

export class RustProtobufTargetLanguageStrategy implements IProtobufTargetLanguageStrategy {
  readonly outputDirectoryName = "rust";
  readonly plugins = [
    {
      remote: `buf.build/community/neoeinstein-prost:v${PROST_PLUGIN_VERSION}`,
    },
    {
      remote: `buf.build/community/neoeinstein-tonic:v${PROST_PLUGIN_VERSION}`,
      // lib.rs includes messages and service stubs into the same package module.
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
