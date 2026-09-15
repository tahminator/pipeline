import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProtobufCompilerBackend } from "../types";
import { ArtifactKeeperJavaPublisher } from "./publisher/java";
import { ArtifactKeeperRustPublisher } from "./publisher/rust";

const config = {
  type: ProtobufCompilerBackend.ARTIFACT_KEEPER,
  url: "https://packages.example.com",
  username: "test",
  token: "test",
} as const;
const javaPublisher = new ArtifactKeeperJavaPublisher(config);
const rustPublisher = new ArtifactKeeperRustPublisher(config);
const java = { groupId: "com.example", artifactId: "test", version: "1.0.0" };

test("Maven declares dependencies needed by public service signatures", () => {
  const pom = javaPublisher.createMavenPom(java);
  for (const artifact of [
    "protobuf-java",
    "grpc-protobuf",
    "grpc-stub",
    "javax.annotation-api",
  ]) {
    expect(pom).toContain(`<artifactId>${artifact}</artifactId>`);
  }
  expect(pom).toContain("<version>1.75.0</version>");
});

test("Gradle exposes SDK dependencies to consumers at compile time", () => {
  const build = javaPublisher.createGradleBuild(java);
  expect(build).toContain('id "java-library"');
  expect(build).toContain('api "com.google.protobuf:protobuf-java:4.32.1"');
  expect(build).toContain('api "io.grpc:grpc-protobuf:1.75.0"');
  expect(build).toContain('api "io.grpc:grpc-stub:1.75.0"');
  expect(build).toContain(
    'compileOnly "javax.annotation:javax.annotation-api:1.3.2"',
  );
});

test("uses the protobuf-java version required by generated code", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "protobuf-java-test-"));
  try {
    const sourceDirectory = path.join(directory, "src", "main", "java");
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(
      path.join(sourceDirectory, "Generated.java"),
      "// Protobuf Java Version: 4.36.0\n",
    );

    const resolved = await javaPublisher["resolveProtobufJavaVersion"]({
      generatedDirectory: directory,
      options: java,
    });

    expect(resolved.protobufJavaVersion).toBe("4.36.0");
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("Cargo includes well-known types and the Tonic Prost codec", () => {
  const manifest = rustPublisher.createCargoToml({
    crateName: "test",
    version: "1.0.0",
  });
  for (const dependency of ["prost", "prost-types", "tonic", "tonic-prost"]) {
    expect(manifest).toContain(`${dependency} = "0.14.1"`);
  }
});
