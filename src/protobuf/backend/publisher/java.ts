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
  ProtobufArtifactKeeperBackend,
  ProtobufJavaTargetLanguageOptions,
} from "../../types";

import {
  DEFAULT_PROTOBUF_JAVA_VERSION,
  GRPC_JAVA_VERSION,
} from "../../versions";

/**
 * Publish generated Java code to the Maven repository in Artifact Keeper.
 *
 * ```text
 * Buf only generates Java source files.
 * Maven and Gradle need a project layout and build files.
 * This publisher creates that project wrapper and then deploys it.
 * ```
 */
export class ArtifactKeeperJavaPublisher {
  static JAVA_LANGUAGE_VERSION = "17";

  constructor(private readonly config: ProtobufArtifactKeeperBackend) {}

  async publish({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufJavaTargetLanguageOptions;
  }): Promise<void> {
    /*
     * Buf writes packages at the output root.
     * Java build tools expect sources in src/main/java.
     */
    await this.moveSources(generatedDirectory);

    switch (options.buildTool) {
      case "gradle":
        return await this.publishGradle({ generatedDirectory, options });
      case "maven":
        return await this.publishMaven({ generatedDirectory, options });
    }
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

    /*
     * Write credentials to a temporary Maven settings file.
     * Do not put secrets into the generated project directory.
     */
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
    /*
     * Gradle needs a build file and a settings file.
     * Credentials are passed as project properties at publish time.
     */
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

  private async moveSources(generatedDirectory: string): Promise<void> {
    /*
     * Move only generated package directories.
     * Leave build files and an existing src directory in place.
     */
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

  /*
   * Keep this public for tests.
   * It is generated here because Buf does not write Maven project files.
   */
  createMavenPom(options: ProtobufJavaTargetLanguageOptions): string {
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
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-protobuf</artifactId>
      <version>${GRPC_JAVA_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-stub</artifactId>
      <version>${GRPC_JAVA_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>javax.annotation</groupId>
      <artifactId>javax.annotation-api</artifactId>
      <version>1.3.2</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>
  <distributionManagement>
    <repository>
      <id>maven</id>
      <url>${this.escapeXml(this.repositoryUrl)}</url>
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

  /*
   * Keep this public for tests.
   * It is generated here because Buf does not write Gradle project files.
   */
  createGradleBuild(options: ProtobufJavaTargetLanguageOptions): string {
    const protobufVersion =
      options.protobufJavaVersion ?? DEFAULT_PROTOBUF_JAVA_VERSION;

    return `plugins {
    id "java-library"
    id "maven-publish"
}

group = "${options.groupId}"
version = "${options.version}"

repositories {
    mavenCentral()
}

dependencies {
    api "com.google.protobuf:protobuf-java:${protobufVersion}"
    api "io.grpc:grpc-protobuf:${GRPC_JAVA_VERSION}"
    api "io.grpc:grpc-stub:${GRPC_JAVA_VERSION}"
    compileOnly "javax.annotation:javax.annotation-api:1.3.2"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${ArtifactKeeperJavaPublisher.JAVA_LANGUAGE_VERSION})
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
            url = uri("${this.repositoryUrl}")
            credentials {
                username = project.findProperty("mavenUsername")
                password = project.findProperty("mavenPassword")
            }
        }
    }
}
`;
  }

  private escapeXml(value: string): string {
    /*
     * User-provided package data goes into XML.
     * Escape it before Maven reads the file.
     */
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

  private get repositoryUrl(): string {
    return `${this.config.url.replace(/\/$/, "")}/maven/maven/`;
  }
}
