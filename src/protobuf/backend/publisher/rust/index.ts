import { $ } from "bun";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ProtobufArtifactKeeperBackend,
  ProtobufRustTargetLanguageOptions,
} from "../../../types";

import { DEFAULT_PROST_VERSION, TONIC_VERSION } from "../../../versions";
import { createRustLibrary } from "./library";

/**
 * Publish generated Rust code as a Cargo crate.
 *
 * ```text
 * Buf only generates .rs files.
 * Cargo needs Cargo.toml and src/lib.rs.
 * This publisher adds those files before cargo publish runs.
 * ```
 */
export class ArtifactKeeperRustPublisher {
  constructor(private readonly config: ProtobufArtifactKeeperBackend) {}

  async publish({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufRustTargetLanguageOptions;
  }): Promise<void> {
    const generatedFiles = await this.findRustFiles(generatedDirectory);

    /*
     * Add the two files that make the generated code a crate.
     * Cargo.toml gives package data and dependencies.
     * src/lib.rs exposes the generated modules to users.
     */
    await mkdir(path.join(generatedDirectory, "src"), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(generatedDirectory, "Cargo.toml"),
        this.createCargoToml(options),
      ),
      writeFile(
        path.join(generatedDirectory, "src", "lib.rs"),
        createRustLibrary(generatedFiles),
      ),
    ]);

    /*
     * Artifact Keeper exposes Cargo as a sparse registry.
     * Cargo reads these CARGO_REGISTRIES_* variables for this publish.
     */
    await $.env({
      ...process.env,
      CARGO_REGISTRIES_CARGO_INDEX: this.indexUrl,
      CARGO_REGISTRIES_CARGO_TOKEN: this.config.token,
      CARGO_REGISTRIES_CARGO_CREDENTIAL_PROVIDER: "cargo:token",
    })`cargo publish --registry cargo`.cwd(generatedDirectory);
  }

  /*
   * Find generated Rust files before we add src/lib.rs.
   * Do not scan src, or lib.rs can include itself on a re-run.
   */
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

  /*
   * Keep this public for tests.
   * It is generated here because Buf does not write Cargo manifests.
   */
  createCargoToml(options: ProtobufRustTargetLanguageOptions): string {
    const prostVersion = options.prostVersion ?? DEFAULT_PROST_VERSION;

    return `[package]
name = "${options.crateName}"
version = "${options.version}"
edition = "2021"

[dependencies]
prost = "${prostVersion}"
prost-types = "${prostVersion}"
tonic = "${TONIC_VERSION}"
tonic-prost = "${TONIC_VERSION}"
`;
  }

  private get indexUrl(): string {
    return `sparse+${this.config.url.replace(/\/$/, "")}/cargo/cargo/`;
  }
}
