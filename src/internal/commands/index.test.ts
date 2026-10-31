import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  isActiveMemberOfAnyTeam,
  loadCommands,
  parseCommands,
  parseTeams,
} from "./helper";

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

test("team slugs normalize and cannot inject into the membership URL", () => {
  expect(parseTeams("")).toEqual([]);
  expect(parseTeams("maintainers,\nrelease-managers")).toEqual([
    "maintainers",
    "release-managers",
  ]);
  for (const teams of ["../members", "a;rm", "team/other", "a?x=1"]) {
    expect(() => parseTeams(teams)).toThrow();
  }
});

async function checkTeams(
  teams: string[],
  memberships: Record<string, number | string>,
): Promise<boolean> {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const team = new URL(request.url).pathname.split("/")[4] ?? "";
      const membership = memberships[team] ?? 404;
      return typeof membership === "number"
        ? new Response("{}", { status: membership })
        : Response.json({ state: membership });
    },
  });
  try {
    return await isActiveMemberOfAnyTeam({
      teams,
      org: "org",
      username: "user",
      token: "token",
      apiUrl: server.url.origin,
    });
  } finally {
    await server.stop(true);
  }
}

test("active membership in any listed team allows the commenter", async () => {
  await expect(checkTeams(["a", "b"], { b: "active" })).resolves.toBe(true);
});

test("pending invitations and missing memberships deny the commenter", async () => {
  await expect(checkTeams(["a"], { a: "pending" })).resolves.toBe(false);
  await expect(checkTeams(["a", "b"], {})).resolves.toBe(false);
});

test("membership API errors fail instead of silently allowing or denying", async () => {
  await expect(checkTeams(["a"], { a: 403 })).rejects.toThrow();
});
