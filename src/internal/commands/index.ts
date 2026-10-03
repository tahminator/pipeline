import { appendFile } from "node:fs/promises";
import yargs from "yargs";

import { loadCommands, parseCommands } from "./helper";

const { commands, dynamicCommandsBunScript, file, workspace } = await yargs(
  process.argv.slice(2),
)
  .option("commands", {
    type: "string",
    describe: "Hardcoded command names separated by commas or newlines",
  })
  .option("dynamicCommandsBunScript", {
    type: "string",
    describe: "Repository-relative Bun loader path",
  })
  .option("file", {
    type: "string",
    describe: "Execute the previously validated Bun loader",
  })
  .option("workspace", {
    type: "string",
    default: process.env.GITHUB_WORKSPACE,
    describe: "Repository root for loader execution",
  })
  .conflicts("file", ["commands", "dynamicCommandsBunScript"])
  .strict()
  .parse();

async function main() {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  let result: { commands: string; file: string };
  if (file) {
    if (!workspace)
      throw new Error("--workspace or GITHUB_WORKSPACE is required");
    result = { commands: await loadCommands(file, workspace), file: "" };
  } else {
    result = parseCommands(commands ?? "", dynamicCommandsBunScript ?? "");
  }
  await appendFile(
    output,
    `commands<<__COMMANDS__\n${result.commands}\n__COMMANDS__\nfile=${result.file}\n`,
  );
}

await main();
