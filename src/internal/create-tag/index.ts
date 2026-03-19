import { GitHubClient } from "../../gh";
import { Utils } from "../../utils";

async function main() {
  const { githubPat } = parseCiEnv(await Utils.getEnvVariables(["ci"]));

  const ghClient = new GitHubClient(githubPat);
  await ghClient.createTag({
    onPreTagCreate: async (tag) => {
      const file = Bun.file("./package.json");

      const pkg = await file.json();
      pkg.version = tag;

      await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n");

      console.log(`Successfully updated version in package.json to ${tag}`);
    },
  });
}

function parseCiEnv(ciEnv: Record<string, string>) {
  const githubPat = (() => {
    const v = ciEnv["GITHUB_PAT"];
    if (!v) {
      throw new Error("Missing GITHUB_PAT from .env.ci");
    }
    return v;
  })();

  return { githubPat };
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
