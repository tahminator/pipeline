import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProtobufCompilerClient } from "./client";
import {
  type ProtobufTargetLanguages,
  ProtobufSourceLanguage,
  ProtobufTargetLanguage,
} from "./types";

let fixtureDirectory: string | undefined;

afterEach(async () => {
  if (!fixtureDirectory) return;

  await rm(fixtureDirectory, { force: true, recursive: true });
  fixtureDirectory = undefined;
});

function getTargetLanguageOptions(
  targetLanguage: ProtobufTargetLanguage,
): ProtobufTargetLanguages {
  switch (targetLanguage) {
    case ProtobufTargetLanguage.JAVA:
      return {
        [ProtobufTargetLanguage.JAVA]: {
          artifactId: "greeting-client",
          groupId: "com.example",
          version: "1.0.0",
        },
      };
    case ProtobufTargetLanguage.RUST:
      return {
        [ProtobufTargetLanguage.RUST]: {
          crateName: "greeting-client",
          version: "1.0.0",
        },
      };
    case ProtobufTargetLanguage.GO:
      return {
        [ProtobufTargetLanguage.GO]: {
          modulePath: "example.com/proto/example/v1",
          version: "1.0.0",
        },
      };
  }
}

async function compileTarget(targetLanguage: ProtobufTargetLanguage) {
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), "protobuf-client-"));
  const protoFilePath = path.join(fixtureDirectory, "greeting.proto");
  const outputDirectory = path.join(fixtureDirectory, "generated");

  await writeFile(path.join(fixtureDirectory, "buf.yaml"), "version: v2\n");
  await writeFile(
    protoFilePath,
    `syntax = "proto3";

package example.v1;

option go_package = "example.com/proto/example/v1;examplev1";
option java_multiple_files = true;
option java_package = "com.example.v1";

message Greeting {
  string name = 1;
}
`,
  );

  console.log(
    "buf token passed into tests?",
    process.env.BUF_TOKEN !== undefined,
  );

  const client = new ProtobufCompilerClient();
  const result = await client.compile({
    sourceLanguage: ProtobufSourceLanguage.RUST,
    targetLanguages: getTargetLanguageOptions(targetLanguage),
    protoFilesLocation: protoFilePath,
    outputDirectory,
    bufToken: process.env.BUF_TOKEN,
  });

  const generatedDirectory = result.generatedDirectories[targetLanguage];
  if (!generatedDirectory) {
    throw new Error("Target output directory was not returned.");
  }

  return generatedDirectory;
}

test("generates a Java client with Buf", async () => {
  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.JAVA);

  expect(
    await Bun.file(
      path.join(generatedDirectory, "com", "example", "v1", "Greeting.java"),
    ).exists(),
  ).toBe(true);
});

test("generates a Rust client with Buf", async () => {
  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.RUST);

  expect(
    await Bun.file(
      path.join(generatedDirectory, "example", "v1", "example.v1.rs"),
    ).exists(),
  ).toBe(true);
});

test("generates a Go client with Buf", async () => {
  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.GO);

  expect(
    await Bun.file(
      path.join(
        generatedDirectory,
        "example.com",
        "proto",
        "example",
        "v1",
        "greeting.pb.go",
      ),
    ).exists(),
  ).toBe(true);
});
