export function decodeBase64EncodedString(s: string) {
  return Buffer.from(s, "base64").toString("utf-8");
}
