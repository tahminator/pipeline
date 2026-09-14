import { expect, test } from "bun:test";

import { JavaProtobufTargetLanguageStrategy } from "./java";

test("pins the Java generator to the default runtime release", () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  expect(new JavaProtobufTargetLanguageStrategy().plugins[0]!.remote).toBe(
    "buf.build/protocolbuffers/java:v32.1",
  );
});

test("pins the Java generator when the runtime is overridden", () => {
  for (const [runtime, generator] of [
    ["4.33.5", "33.5"],
    ["3.25.3", "25.3"],
    ["3.20.3", "3.20.3"],
  ]) {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      new JavaProtobufTargetLanguageStrategy(runtime).plugins[0]!.remote,
    ).toBe(`buf.build/protocolbuffers/java:v${generator}`);
  }
});

test("rejects runtime ranges that cannot pin a matching generator", () => {
  expect(() => new JavaProtobufTargetLanguageStrategy("^4.32.1")).toThrow(
    "exact stable",
  );
});
