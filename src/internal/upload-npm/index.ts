import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { NPMClient } from "../../npm";
import { Utils } from "../../utils";

const { dryRun } = await yargs(hideBin(process.argv))
  .option("dryRun", {
    type: "boolean",
    default: false,
  })
  .strict()
  .parse();

async function main() {
  const { npmToken } = parseCiEnv(await Utils.getEnvVariables(["ci"]));
  await using npmClient = await NPMClient.create(npmToken);

  await npmClient.publish(dryRun);
}

function parseCiEnv(ciEnv: Record<string, string>) {
  const npmToken = (() => {
    const v = ciEnv["NPM_TOKEN"];
    if (!v) {
      throw new Error("Missing NPM_TOKEN from .env.ci");
    }
    return v;
  })();

  return { npmToken };
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
