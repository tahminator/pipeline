import { appendFile } from "node:fs/promises";

async function main() {
  const githubEnvLoc = process.env.GITHUB_ENV;
  if (!githubEnvLoc) {
    throw new Error("GITHUB_ENV is missing from environment");
  }

  const secretsJson = process.env.SECRETS;
  if (!secretsJson) {
    throw new Error("SECRETS is required and not defined");
  }

  for (const [k, _v] of Object.entries(JSON.parse(secretsJson))) {
    const v = String(_v);
    if (v === "true" || v === "false" || v === "") {
      console.log(`Not masking ${k}: true/false/empty v`);
      continue;
    }

    console.log(`Masking ${k}`);

    const lines = v.split("\n");
    if (lines.length == 1) {
      console.log(`::add-mask::${v}`);
    } else {
      for (const line of lines) {
        if (!line.trim().length) continue;
        console.log(`::add-mask::${line}`);
      }
    }
    if (lines.length === 1) {
      await appendFile(githubEnvLoc, `${k}=${v}\n`);
    } else {
      await appendFile(githubEnvLoc, `${k}<<__EOF__\n${v}\n__EOF__\n`);
    }
  }
}

void main();
