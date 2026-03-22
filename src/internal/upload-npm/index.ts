import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { NPMClient } from "../../npm";

const { dryRun } = await yargs(hideBin(process.argv))
  .option("dryRun", {
    type: "boolean",
    default: false,
  })
  .strict()
  .parse();

async function main() {
  await using npmClient = await NPMClient.create();

  await npmClient.publish(dryRun);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
