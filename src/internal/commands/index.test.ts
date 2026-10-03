import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadCommands, parseCommands } from "./helper";

test("inline names normalize to the dispatch action's newline format", () => {
  expect(parseCommands("merge\nai, copy", "")).toEqual({
    commands: "merge\nai\ncopy",
    file: "",
  });
  expect(parseCommands("true", "").commands).toBe("true");
});

test("the dynamic script input selects a loader", () => {
  expect(
    parseCommands("", ".github/scripts/src/load-slash-commands/index.ts"),
  ).toEqual({
    commands: "",
    file: ".github/scripts/src/load-slash-commands/index.ts",
  });
});

test("exactly one command source is required", () => {
  for (const [commands, file] of [
    ["", ""],
    [" \n", " "],
    ["merge", "loader.ts"],
  ]) {
    expect(() => parseCommands(commands ?? "", file ?? "")).toThrow();
  }
});

test("invalid names and loader paths cannot escape the checkout or inject outputs", () => {
  for (const commands of [
    "merge; echo hacked",
    "[merge, ai]",
    "file: loader.ts",
  ]) {
    expect(() => parseCommands(commands, "")).toThrow();
  }
  for (const file of [
    "../outside.ts",
    "/tmp/outside.ts",
    "loader.ts\nallowed=true",
  ]) {
    expect(() => parseCommands("", file)).toThrow();
  }
});

async function runLoader(source: string): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "commands-loader-"));
  try {
    await writeFile(path.join(workspace, "loader.ts"), source);
    return await loadCommands("loader.ts", workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test("loader stdout becomes commands without including stderr diagnostics", async () => {
  await expect(
    runLoader(
      'console.error("loader diagnostic"); console.log("merge\\nai, copy");',
    ),
  ).resolves.toBe("merge\nai\ncopy");
});

test("loader failure rejects even when it printed valid commands", async () => {
  await expect(
    runLoader('console.log("merge"); process.exit(2);'),
  ).rejects.toThrow();
});

test("empty or invalid loader stdout cannot become dispatch commands", async () => {
  for (const source of [
    "",
    'console.log("   ");',
    'console.log(",\\n");',
    'console.log("::set-output name=commands::merge");',
  ]) {
    await expect(runLoader(source)).rejects.toThrow();
  }
});
