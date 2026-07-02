import { decodeBase64EncodedString } from "./b64";
import { isCmdAvailable } from "./cmd";
import { Colors } from "./colors";
import { Log } from "./log";
import { SemVer } from "./semver";
import { generateShortId } from "./short";
import { required } from "./string";
import { waitUntil } from "./wait";

export class Utils {
  // hoist
  static Colors = Colors;
  static Log = Log;
  static SemVer = SemVer;

  static generateShortId(...args: Parameters<typeof generateShortId>) {
    return generateShortId(...args);
  }

  static async isCmdAvailable(...args: Parameters<typeof isCmdAvailable>) {
    return isCmdAvailable(...args);
  }

  static async decodeBase64EncodedString(
    ...args: Parameters<typeof decodeBase64EncodedString>
  ) {
    return decodeBase64EncodedString(...args);
  }

  static async waitUntil(...args: Parameters<typeof waitUntil>) {
    return waitUntil(...args);
  }

  static required<T>(...args: Parameters<typeof required<T>>) {
    return required<T>(...args);
  }
}
