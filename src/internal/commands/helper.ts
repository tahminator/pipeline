import { realpath, stat } from "node:fs/promises";
import path from "node:path";

/** Exactly one source: inline names or a repository-owned Bun loader. */
export function parseCommands(
  input: string,
  file: string,
): {
  commands: string;
  file: string;
} {
  if (Boolean(input.trim()) === Boolean(file.trim())) {
    throw new Error(
      "Set exactly one of COMMANDS or DYNAMIC_COMMANDS_BUN_SCRIPT",
    );
  }
  if (file.trim()) {
    if (
      /[\r\n]/.test(file) ||
      path.isAbsolute(file) ||
      file.split(/[\\/]/).includes("..")
    ) {
      throw new Error(
        "DYNAMIC_COMMANDS_BUN_SCRIPT must be a repository-relative file path",
      );
    }
    return { commands: "", file };
  }
  const commands = input.split(/[\s,]+/).filter(Boolean);
  if (
    !commands.length ||
    commands.some((name) => !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name))
  ) {
    throw new Error(
      "COMMANDS must contain command names separated by commas or newlines",
    );
  }
  return { commands: commands.join("\n"), file: "" };
}

/** Runs only after the action has checked write permission and rejected fork heads. */
export async function loadCommands(
  file: string,
  workspace: string,
): Promise<string> {
  const root = await realpath(workspace);
  const source = await realpath(path.resolve(root, file));
  const relative = path.relative(root, source);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !(await stat(source)).isFile()
  ) {
    throw new Error("The command loader must be a file inside the repository");
  }

  const child = Bun.spawn([process.execPath, "run", "--no-install", source], {
    cwd: root,
    stdout: "pipe",
    stderr: "inherit",
  });
  const stdout = await new Response(child.stdout).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Command loader exited with code ${exitCode}`);
  }
  return parseCommands(stdout, "").commands;
}
