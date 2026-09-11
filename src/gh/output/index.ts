export class GitHubOutputManager {
  constructor() {}

  async outputToGithubOutput({
    overrideGithubOutputFile,
    ctx,
  }: {
    overrideGithubOutputFile?: string;
    ctx: Record<string, unknown>;
  }): Promise<void> {
    const githubOutputEnv = (() => {
      const v = process.env.GITHUB_OUTPUT;
      return v;
    })();

    const githubOutput = overrideGithubOutputFile ?? githubOutputEnv;
    if (!githubOutput) {
      throw new Error(
        "Failed to find GITHUB_OUTPUT from environment and no explicit github output file override defined",
      );
    }

    console.log("Outputting GitHub output...");
    const w = Bun.file(githubOutput).writer();
    for (const [k, v] of Object.entries(ctx)) {
      console.log(`Piping ${k}`);
      await w.write(`${k}<<EOF\n${JSON.stringify(v)}\nEOF\n`);
    }
    await w.flush();
    await w.end();
    console.log("GitHub output complete");
  }
}
