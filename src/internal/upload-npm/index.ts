import { NPMClient } from "../../npm";
import { Utils } from "../../utils";

async function main() {
  const { npmToken } = parseCiEnv(await Utils.getEnvVariables(["ci"]));
  await using npmClient = await NPMClient.create(npmToken);

  await npmClient.publish();
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
