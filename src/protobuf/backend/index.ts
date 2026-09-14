import type { IProtobufCompilerBackendStrategy } from "./types";

import {
  type ProtobufCompilerBackendConfig,
  ProtobufCompilerBackend,
} from "../types";
import { ArtifactKeeperProtobufCompilerBackend } from "./artifact-keeper";

export * from "./artifact-keeper";
export * from "./types";

const BACKEND_STRATEGY_FACTORIES: Record<
  ProtobufCompilerBackend,
  (backend: ProtobufCompilerBackendConfig) => IProtobufCompilerBackendStrategy
> = {
  [ProtobufCompilerBackend.ARTIFACT_KEEPER]: (backend) =>
    new ArtifactKeeperProtobufCompilerBackend(backend),
};

export function createProtobufCompilerBackendStrategy(
  backend: ProtobufCompilerBackendConfig,
): IProtobufCompilerBackendStrategy {
  return BACKEND_STRATEGY_FACTORIES[backend.type](backend);
}
