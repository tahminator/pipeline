export const DEFAULT_PROTOBUF_JAVA_VERSION = "4.32.1";

/** Java runtime releases include a language major absent from modern protoc tags. */
export function javaGeneratorVersion(runtimeVersion: string): string {
  const match = /^(3|4)\.(\d+)\.(\d+)$/.exec(runtimeVersion);
  if (!match) {
    throw new Error(
      "protobufJavaVersion must be an exact stable 3.x or 4.x version.",
    );
  }
  const [, major, minor, patch] = match;
  // Before protoc 21, compiler and Java runtime used the same 3.x version.
  return major === "3" && Number(minor) < 21 ?
      runtimeVersion
    : `${minor}.${patch}`;
}
