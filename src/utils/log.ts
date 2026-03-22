export class Log {
  static debugLog(...data: unknown[]) {
    if (this.isDebug) {
      console.debug(data);
    }
  }

  // automatically injected from setup action in CI
  static get isDebug(): boolean {
    return process.env.DEBUG === "true";
  }
}
