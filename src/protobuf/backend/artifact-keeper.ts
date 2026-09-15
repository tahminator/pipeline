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
import { ArtifactKeeperGoPublisher } from "./publisher/go";
import { ArtifactKeeperJavaPublisher } from "./publisher/java";
import { ArtifactKeeperRustPublisher } from "./publisher/rust/index";

/**
 * Select the publisher for one target language.
 *
 * ```text
 * The language publishers contain the package-manager rules.
 * This class only routes the publish request.
 * ```
 */
export class ArtifactKeeperProtobufCompilerBackend implements IProtobufCompilerBackendStrategy {
  constructor(private readonly config: ProtobufArtifactKeeperBackend) {}

  async publish({
    generatedDirectory,
    targetLanguage,
    options,
  }: ProtobufCompilerBackendPublishArgs): Promise<void> {
    switch (targetLanguage) {
      case ProtobufTargetLanguage.JAVA:
        await new ArtifactKeeperJavaPublisher(this.config).publish({
          generatedDirectory,
          options: options as ProtobufJavaTargetLanguageOptions,
        });
        return;
      case ProtobufTargetLanguage.RUST:
        await new ArtifactKeeperRustPublisher(this.config).publish({
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
}
