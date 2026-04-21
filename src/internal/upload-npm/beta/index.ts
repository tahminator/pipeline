import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { GitHubClient } from "../../../gh";
import { NPMClient } from "../../../npm";
import { Utils } from "../../../utils";

const { sha } = await yargs(hideBin(process.argv))
  .option("sha", {
    type: "string",
    demandOption: true,
  })
  .strict()
  .parse();

async function main() {
  const ghClient = await GitHubClient.createWithDefaultCiToken();
  const npmClient = await NPMClient.create();

  const shortSha = await getShortSha(sha);

  const lastTag = (await ghClient.getLatestTag()) ?? GitHubClient.BASE_VERSION;

  const betaVersion = `${lastTag}-beta.${shortSha}`;

  if (!Utils.SemVer.validate(betaVersion)) {
    throw new Error(`Generated invalid beta version: ${betaVersion}`);
  }

  await Utils.updateAllPackageJsonsWithVersion(betaVersion);
  await npmClient.publish(false, true);

  console.log(`Uploaded ${betaVersion} to NPM.`);
}

async function getShortSha(sha: string) {
  const shortSha = sha.slice(0, 8).toString().trim();

  if (shortSha.length !== 8) {
    throw new Error("Could not parse git SHA");
  }

  return shortSha;
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
