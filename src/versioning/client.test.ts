import { expect, spyOn, test } from "bun:test";
import semver from "semver";

import type { GitHubClient } from "../gh";

import { VersioningClient } from "./client";
import { VersionUpdatingStrategy } from "./types";

for (const latestTag of ["1.3.2", undefined]) {
  for (const sha of ["58cf28bd", "01234567", "12345678"]) {
    test(`nextBeta prefixes SHA ${sha} with g (latest tag: ${latestTag})`, async () => {
      const githubClient = {
        getLatestTag: async () => latestTag,
      } as unknown as GitHubClient;
      const client = new VersioningClient(
        githubClient,
        VersionUpdatingStrategy.NONE,
      );
      const warn = spyOn(console, "warn").mockImplementation(() => {});
      try {
        const version = await client.nextBeta(sha);
        expect(version).toBe(`${latestTag ?? "1.0.0"}-beta.g${sha}`);
        expect(semver.valid(version)).toBe(version);
        if (!latestTag)
          expect(warn).toHaveBeenCalledWith(expect.stringContaining(version));
      } finally {
        warn.mockRestore();
      }
    });
  }
}
