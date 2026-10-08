import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

async function main() {
  const tools = [
    {
      name: "oxlint",
      args: [],
      fix: "For lint issues that support autofix, run `bun run oxlint --fix` from your CI scripts package directory. Other issues require manual fixes.",
    },
    {
      name: "oxfmt",
      args: ["--check"],
      fix: "To fix formatting, run `bun run oxfmt --write` from your CI scripts package directory.",
    },
  ];

  for (const tool of tools) {
    let launcher: string | undefined;
    try {
      const manifest = Bun.resolveSync(
        `${tool.name}/package.json`,
        process.cwd(),
      );
      launcher = join(dirname(manifest), "bin", tool.name);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        (error.code !== "MODULE_NOT_FOUND" &&
          error.code !== "ERR_MODULE_NOT_FOUND")
      ) {
        throw error;
      }
    }

    if (!launcher || !existsSync(launcher)) {
      console.error(
        `pipeline: ${tool.name} is missing. Add ${tool.name} as a devDependency to your CI scripts package.json by running \`bun add -d ${tool.name}\` in that directory.`,
      );
      process.exitCode = 1;
      continue;
    }

    const child = Bun.spawn([process.execPath, launcher, ...tool.args], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await child.exited;

    if (child.signalCode) {
      process.kill(process.pid, child.signalCode);
      return;
    }
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      console.error(`pipeline: ${tool.fix}`);
    }
  }
}

await main();
