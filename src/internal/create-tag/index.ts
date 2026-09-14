import { GitHubClient } from "../../gh";
import { VersioningClient, VersionUpdatingStrategy } from "../../versioning";

async function main() {
  const { githubAppAppId, githubAppInstallationId, githubAppPrivateKey } =
    parseCiEnv(process.env);

  const ghClient = await GitHubClient.createWithGithubAppToken({
    appId: githubAppAppId,
    installationId: githubAppInstallationId,
    privateKey: githubAppPrivateKey,
  });

  const versioningClient = new VersioningClient(
    ghClient,
    VersionUpdatingStrategy.JSTS,
  );

  const rootPkgJson: {
    version: string;
  } = await Bun.file("./package.json").json();

  await ghClient.createTag({
    nextTag: await versioningClient.next(rootPkgJson.version),
    onPreTagCreate: async (tag) => {
      const file = Bun.file("./package.json");

      const pkg = await file.json();
      pkg.version = tag;

      await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n");

      console.log(`Successfully updated version in package.json to ${tag}`);
    },
  });
}

function parseCiEnv(ciEnv: Record<string, string | undefined>) {
  const githubAppAppId = (() => {
    const v = ciEnv["_GITHUB_APP_APP_ID"];
    if (!v) {
      throw new Error("Missing _GITHUB_APP_APP_ID from env");
    }
    return v;
  })();

  const githubAppInstallationId = (() => {
    const v = ciEnv["_GITHUB_APP_INSTALLATION_ID"];
    if (!v) {
      throw new Error("Missing _GITHUB_APP_INSTALLATION_ID from env");
    }
    return v;
  })();

  const githubAppPrivateKey = (() => {
    const v = ciEnv["_GITHUB_APP_PEM_CONTENT"];
    if (!v) {
      throw new Error("Missing _GITHUB_APP_PEM_CONTENT from env");
    }
    return v;
  })();

  return { githubAppAppId, githubAppInstallationId, githubAppPrivateKey };
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
