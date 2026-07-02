import type { IJavascriptPackageJsonVersionUpdatingClient } from "../../types";

import { BaseVersionUpdatingClient } from "../base";

export class NoneVersioningClient
  extends BaseVersionUpdatingClient
  implements IJavascriptPackageJsonVersionUpdatingClient
{
  async update(version: string): Promise<void> {
    console.log(`NoneVersioningClient will not write ${version} anywhere.`);
  }
}
