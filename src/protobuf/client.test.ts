import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { isCmdAvailable } from "../utils/cmd";
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
          version: "1.0.0",
        },
      };
  }
}

async function hasTargetToolchains(
  targetLanguage: ProtobufTargetLanguage,
): Promise<boolean> {
  const commands = {
    [ProtobufTargetLanguage.JAVA]: ["buf", "protoc-gen-grpc-java"],
    [ProtobufTargetLanguage.RUST]: [
      "buf",
      "protoc-gen-prost",
      "protoc-gen-tonic",
    ],
    [ProtobufTargetLanguage.GO]: ["buf", "protoc-gen-go", "protoc-gen-go-grpc"],
  }[targetLanguage];

  for (const command of commands) {
    if (!(await isCmdAvailable(command))) return false;
  }
  return true;
}

async function compileTarget(targetLanguage: ProtobufTargetLanguage) {
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), "protobuf-client-"));
  const protoFilePath = path.join(fixtureDirectory, "greeting.proto");
  const outputDirectory = path.join(fixtureDirectory, "generated");

  await writeFile(path.join(fixtureDirectory, "buf.yaml"), "version: v2\n");
  await writeFile(
    path.join(fixtureDirectory, "common.proto"),
    `syntax = "proto3";
package common.v1;
option go_package = "example.com/proto/common/v1;commonv1";
option java_package = "com.example.common.v1";
message Metadata { string id = 1; }
`,
  );
  await writeFile(
    protoFilePath,
    `syntax = "proto3";

package example.v1;

import "common.proto";
import "google/protobuf/timestamp.proto";

option go_package = "example.com/proto/example/v1;examplev1";
option java_multiple_files = true;
option java_package = "com.example.v1";

message Greeting {
  string name = 1;
  common.v1.Metadata metadata = 2;
  google.protobuf.Timestamp received_at = 3;
}

service Greeter {
  rpc SayHello(Greeting) returns (Greeting);
  rpc Watch(Greeting) returns (stream Greeting);
}
`,
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
  if (!(await hasTargetToolchains(ProtobufTargetLanguage.JAVA))) return;

  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.JAVA);

  const service = await Bun.file(
    path.join(generatedDirectory, "com/example/v1/GreeterGrpc.java"),
  ).text();
  expect(service).toContain("GreeterImplBase");
  expect(service).toContain("GreeterStub");
  expect(
    await Bun.file(
      path.join(generatedDirectory, "com/example/common/v1/Common.java"),
    ).exists(),
  ).toBe(true);

  expect(
    await Bun.file(
      path.join(generatedDirectory, "com", "example", "v1", "Greeting.java"),
    ).exists(),
  ).toBe(true);
}, 120_000);

test("generates a Rust client with Buf", async () => {
  if (!(await hasTargetToolchains(ProtobufTargetLanguage.RUST))) return;

  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.RUST);

  const service = await Bun.file(
    path.join(generatedDirectory, "example/v1/example.v1.tonic.rs"),
  ).text();
  expect(service).toContain("pub trait Greeter");
  expect(service).toContain("pub struct GreeterClient");
  expect(
    await Bun.file(
      path.join(generatedDirectory, "common/v1/common.v1.rs"),
    ).exists(),
  ).toBe(true);

  expect(
    await Bun.file(
      path.join(generatedDirectory, "example", "v1", "example.v1.rs"),
    ).exists(),
  ).toBe(true);
}, 120_000);

test("generates a Go client with Buf", async () => {
  if (!(await hasTargetToolchains(ProtobufTargetLanguage.GO))) return;

  const generatedDirectory = await compileTarget(ProtobufTargetLanguage.GO);

  const service = await Bun.file(
    path.join(
      generatedDirectory,
      "example.com/proto/example/v1/greeting_grpc.pb.go",
    ),
  ).text();
  expect(service).toContain("type GreeterServer interface");
  expect(service).toContain("type GreeterClient interface");
  expect(
    await Bun.file(
      path.join(generatedDirectory, "example.com/proto/common/v1/common.pb.go"),
    ).exists(),
  ).toBe(true);

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
}, 120_000);
