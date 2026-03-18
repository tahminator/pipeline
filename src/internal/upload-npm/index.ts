import { $ } from "bun";

import { getEnvVariables } from "../../utils/env";

async function main() {
  const { npmToken } = parseCiEnv(await getEnvVariables(["ci"]));

  await $`npm config set //registry.npmjs.org/:_authToken=${npmToken}`;
  await $`npm publish --access public`;
  console.log("Package has been successfully published");
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
