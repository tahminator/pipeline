import { $ } from "bun";
import { fromPromise } from "neverthrow";

const GENERIC_ERROR = 1 as const;
const SUCCESS = 0 as const;

export async function isCmdAvailable(cmd: string): Promise<boolean> {
  return (
    (await fromPromise($`which -v ${cmd}`.quiet(), (e) => e)
      .map((s) => s.exitCode)
      .unwrapOr(GENERIC_ERROR)) === SUCCESS
  );
}
