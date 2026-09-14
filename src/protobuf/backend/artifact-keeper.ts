import { $ } from "bun";
import {
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  IProtobufCompilerBackendStrategy,
  ProtobufCompilerBackendPublishArgs,
} from "./types";

import {
  type ProtobufArtifactKeeperBackend,
  type ProtobufGoTargetLanguageOptions,
  type ProtobufJavaTargetLanguageOptions,
  type ProtobufRustTargetLanguageOptions,
  ProtobufTargetLanguage,
} from "../types";
import { DEFAULT_PROTOBUF_JAVA_VERSION } from "../versions";
import { ArtifactKeeperGoPublisher } from "./go";

const DEFAULT_PROST_VERSION = "0.14";

export class ArtifactKeeperProtobufCompilerBackend implements IProtobufCompilerBackendStrategy {
  constructor(private readonly config: ProtobufArtifactKeeperBackend) {}

  async publish({
    generatedDirectory,
    targetLanguage,
    options,
  }: ProtobufCompilerBackendPublishArgs): Promise<void> {
    switch (targetLanguage) {
      case ProtobufTargetLanguage.JAVA:
        await this.publishJava({
          generatedDirectory,
          options: options as ProtobufJavaTargetLanguageOptions,
        });
        return;
      case ProtobufTargetLanguage.RUST:
        await this.publishRust({
          generatedDirectory,
          options: options as ProtobufRustTargetLanguageOptions,
        });
        return;
      case ProtobufTargetLanguage.GO:
        await new ArtifactKeeperGoPublisher(this.config).publish({
          generatedDirectory,
          options: options as ProtobufGoTargetLanguageOptions,
        });
        return;
    }
  }

  private async publishJava({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufJavaTargetLanguageOptions;
  }): Promise<void> {
    await this.moveJavaSources(generatedDirectory);

    if (options.buildTool === "gradle") {
      await this.publishGradle({ generatedDirectory, options });
      return;
    }

    await this.publishMaven({ generatedDirectory, options });
  }

  private async publishMaven({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufJavaTargetLanguageOptions;
  }): Promise<void> {
    await writeFile(
      path.join(generatedDirectory, "pom.xml"),
      this.createMavenPom(options),
    );

    const settingsDirectory = await mkdtemp(
      path.join(tmpdir(), "artifact-keeper-maven-"),
    );
    const settingsPath = path.join(settingsDirectory, "settings.xml");

    await writeFile(settingsPath, this.createMavenSettings());

    try {
      await $`mvn --settings ${settingsPath} deploy`.cwd(generatedDirectory);
    } finally {
      await rm(settingsDirectory, { force: true, recursive: true });
    }
  }

  private async publishGradle({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufJavaTargetLanguageOptions;
  }): Promise<void> {
    await Promise.all([
      writeFile(
        path.join(generatedDirectory, "build.gradle"),
        this.createGradleBuild(options),
      ),
      writeFile(
        path.join(generatedDirectory, "settings.gradle"),
        `rootProject.name = "${options.artifactId}"\n`,
      ),
    ]);

    await $`gradle -PmavenUsername=${this.config.username} -PmavenPassword=${this.config.token} publish`.cwd(
      generatedDirectory,
    );
  }

  private async publishRust({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufRustTargetLanguageOptions;
  }): Promise<void> {
    const generatedFiles = await this.findRustFiles(generatedDirectory);

    await mkdir(path.join(generatedDirectory, "src"), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(generatedDirectory, "Cargo.toml"),
        this.createCargoToml(options),
      ),
      writeFile(
        path.join(generatedDirectory, "src", "lib.rs"),
        this.createRustLibrary(generatedFiles),
      ),
    ]);

    await $.env({
      ...process.env,
      CARGO_REGISTRIES_CARGO_INDEX: this.cargoIndexUrl,
      CARGO_REGISTRIES_CARGO_TOKEN: this.config.token,
      CARGO_REGISTRIES_CARGO_CREDENTIAL_PROVIDER: "cargo:token",
    })`cargo publish --registry cargo`.cwd(generatedDirectory);
  }

  private async moveJavaSources(generatedDirectory: string): Promise<void> {
    const sourceDirectory = path.join(
      generatedDirectory,
      "src",
      "main",
      "java",
    );
    await mkdir(sourceDirectory, { recursive: true });

    for (const entry of await readdir(generatedDirectory, {
      withFileTypes: true,
    })) {
      if (
        entry.name === "src" ||
        entry.name === "pom.xml" ||
        entry.name === "build.gradle" ||
        entry.name === "settings.gradle"
      ) {
        continue;
      }

      await rename(
        path.join(generatedDirectory, entry.name),
        path.join(sourceDirectory, entry.name),
      );
    }
  }

  private async findRustFiles(
    directory: string,
    baseDirectory = directory,
  ): Promise<string[]> {
    const files: string[] = [];

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "src") continue;

        files.push(...(await this.findRustFiles(filePath, baseDirectory)));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".rs")) {
        files.push(
          path.relative(baseDirectory, filePath).split(path.sep).join("/"),
        );
      }
    }

    return files;
  }

  private createMavenPom(options: ProtobufJavaTargetLanguageOptions): string {
    const protobufVersion =
      options.protobufJavaVersion ?? DEFAULT_PROTOBUF_JAVA_VERSION;

    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${this.escapeXml(options.groupId)}</groupId>
  <artifactId>${this.escapeXml(options.artifactId)}</artifactId>
  <version>${this.escapeXml(options.version)}</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
  </properties>
  <dependencies>
    <dependency>
      <groupId>com.google.protobuf</groupId>
      <artifactId>protobuf-java</artifactId>
      <version>${this.escapeXml(protobufVersion)}</version>
    </dependency>
  </dependencies>
  <distributionManagement>
    <repository>
      <id>maven</id>
      <url>${this.escapeXml(this.mavenRepositoryUrl)}</url>
    </repository>
  </distributionManagement>
</project>
`;
  }

  private createMavenSettings(): string {
    return `<settings>
  <servers>
    <server>
      <id>maven</id>
      <username>${this.escapeXml(this.config.username)}</username>
      <password>${this.escapeXml(this.config.token)}</password>
    </server>
  </servers>
</settings>
`;
  }

  private createGradleBuild(
    options: ProtobufJavaTargetLanguageOptions,
  ): string {
    const protobufVersion =
      options.protobufJavaVersion ?? DEFAULT_PROTOBUF_JAVA_VERSION;

    return `plugins {
    id "java"
    id "maven-publish"
}

group = "${options.groupId}"
version = "${options.version}"

repositories {
    mavenCentral()
}

dependencies {
    implementation "com.google.protobuf:protobuf-java:${protobufVersion}"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

publishing {
    publications {
        mavenJava(MavenPublication) {
            from components.java
            artifactId = "${options.artifactId}"
        }
    }
    repositories {
        maven {
            url = uri("${this.mavenRepositoryUrl}")
            credentials {
                username = project.findProperty("mavenUsername")
                password = project.findProperty("mavenPassword")
            }
        }
    }
}
`;
  }

  private createCargoToml(options: ProtobufRustTargetLanguageOptions): string {
    const prostVersion = options.prostVersion ?? DEFAULT_PROST_VERSION;

    return `[package]
name = "${options.crateName}"
version = "${options.version}"
edition = "2021"

[dependencies]
prost = "${prostVersion}"
`;
  }

  private createRustLibrary(generatedFiles: string[]): string {
    return generatedFiles
      .map((relativePath) => {
        const moduleName = relativePath
          .replace(/\.rs$/, "")
          .replace(/[^a-zA-Z0-9_]/g, "_");

        return `pub mod ${moduleName} {
    include!(concat!(env!("CARGO_MANIFEST_DIR"), "/${relativePath}"));
}
`;
      })
      .join("\n");
  }

  private escapeXml(value: string): string {
    return value.replace(/[<>&'"]/g, (character) => {
      switch (character) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
        default:
          return character;
      }
    });
  }

  private get artifactKeeperUrl(): string {
    return this.config.url.replace(/\/$/, "");
  }

  private get mavenRepositoryUrl(): string {
    return `${this.artifactKeeperUrl}/maven/maven/`;
  }

  private get cargoIndexUrl(): string {
    return `sparse+${this.artifactKeeperUrl}/cargo/cargo/`;
  }
}
