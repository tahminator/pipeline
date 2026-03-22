export class Log {
  static debugLog(...data: unknown[]) {
    if (this.isDebug) {
      console.debug(data);
    }
  }

  static get isDebug(): boolean {
    return process.env.ACTIONS_STEP_DEBUG === "true";
  }
}
