export class Log {
  // automatically injected from setup action in CI
  static get isDebug(): boolean {
    return process.env.DEBUG === "true";
  }
}
