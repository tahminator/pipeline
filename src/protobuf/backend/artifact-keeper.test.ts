import { expect, test } from "bun:test";

import { ProtobufCompilerBackend } from "../types";
import { ArtifactKeeperProtobufCompilerBackend } from "./artifact-keeper";

const backend = new ArtifactKeeperProtobufCompilerBackend({
  type: ProtobufCompilerBackend.ARTIFACT_KEEPER,
  url: "https://packages.example.com",
  username: "test",
  token: "test",
});
const java = { groupId: "com.example", artifactId: "test", version: "1.0.0" };

test("Maven declares dependencies needed by public service signatures", () => {
  const pom = backend["createMavenPom"](java);
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
  const build = backend["createGradleBuild"](java);
  expect(build).toContain('id "java-library"');
  expect(build).toContain('api "com.google.protobuf:protobuf-java:4.32.1"');
  expect(build).toContain('api "io.grpc:grpc-protobuf:1.75.0"');
  expect(build).toContain('api "io.grpc:grpc-stub:1.75.0"');
  expect(build).toContain(
    'compileOnly "javax.annotation:javax.annotation-api:1.3.2"',
  );
});

test("Cargo includes well-known types and the Tonic Prost codec", () => {
  const manifest = backend["createCargoToml"]({
    crateName: "test",
    version: "1.0.0",
  });
  for (const dependency of ["prost", "prost-types", "tonic", "tonic-prost"]) {
    expect(manifest).toContain(`${dependency} = "0.14.1"`);
  }
});
