import { expect, test } from "bun:test";

import { JavaProtobufTargetLanguageStrategy } from "./java";

test("uses local Java generators", () => {
  expect(new JavaProtobufTargetLanguageStrategy().plugins).toEqual([
    { protoc_builtin: "java" },
    { local: "protoc-gen-grpc-java" },
  ]);
});

test("rejects runtime ranges because generated dependencies use exact versions", () => {
  expect(() => new JavaProtobufTargetLanguageStrategy("^4.32.1")).toThrow(
    "exact stable",
  );
});
