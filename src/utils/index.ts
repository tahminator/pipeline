import { getEnvVariables } from "./env";
import { generateShortId } from "./short";

export class Utils {
  static getEnvVariables(...args: Parameters<typeof getEnvVariables>) {
    return getEnvVariables(...args);
  }

  static generateShortId(...args: Parameters<typeof generateShortId>) {
    return generateShortId(...args);
  }
}
