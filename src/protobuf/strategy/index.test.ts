import { expect, test } from "bun:test";

import { GoProtobufTargetLanguageStrategy } from "./go";
import { JavaProtobufTargetLanguageStrategy } from "./java";
import { RustProtobufTargetLanguageStrategy } from "./rust";

test("all targets use local message and RPC generators", () => {
  for (const target of [
    new GoProtobufTargetLanguageStrategy(),
    new JavaProtobufTargetLanguageStrategy(),
    new RustProtobufTargetLanguageStrategy(),
  ]) {
    expect(target.plugins).toHaveLength(2);
    for (const plugin of target.plugins)
      expect(plugin).not.toHaveProperty("remote");
  }
});

test("Rust gRPC generation requires the matching Prost runtime series", () => {
  expect(() => new RustProtobufTargetLanguageStrategy("0.13")).toThrow("0.14");
  expect(() => new RustProtobufTargetLanguageStrategy("0.14")).not.toThrow();
});
