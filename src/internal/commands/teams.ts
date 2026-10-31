import { appendFile } from "node:fs/promises";
import yargs from "yargs";

import { isActiveMemberOfAnyTeam, parseTeams } from "./helper";

const { allowedTeams, org, username } = await yargs(process.argv.slice(2))
  .option("allowedTeams", {
    type: "string",
    default: "",
    describe: "Team slugs separated by commas or newlines; empty allows all",
  })
  .option("org", {
    type: "string",
    demandOption: true,
    describe: "Organization that owns the teams",
  })
  .option("username", {
    type: "string",
    demandOption: true,
    describe: "Commenter to check",
  })
  .strict()
  .parse();

async function main() {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  const teams = parseTeams(allowedTeams);
  if (teams.length) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is required");
    const allowed = await isActiveMemberOfAnyTeam({
      teams,
      org,
      username,
      token,
      apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
    });
    if (!allowed) {
      console.log(
        `::notice::Slash commands require active membership in one of: ${teams.join(", ")}.`,
      );
      return;
    }
  }
  await appendFile(output, "allowed=true\n");
}

await main();
