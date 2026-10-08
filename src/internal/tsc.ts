import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

async function main() {
  let launcher: string | undefined;
  try {
    const manifest = Bun.resolveSync("typescript/package.json", process.cwd());
    launcher = join(dirname(manifest), "bin/tsc");
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
      "pipeline: TypeScript is missing. Add typescript as a devDependency to your CI scripts package.json by running `bun add -d typescript` in that directory.",
    );
    process.exitCode = 1;
    return;
  }

  const child = Bun.spawn([process.execPath, launcher, "--noEmit"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;

  if (child.signalCode) process.kill(process.pid, child.signalCode);
  else process.exitCode = exitCode;
}

await main();
