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

test("next returns baseVersion unmodified when no tag exists yet", async () => {
  const githubClient = {
    getLatestTag: async () => null,
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(await client.next("1.0.0")).toBe("1.0.0");
});

test("next returns INITIAL_VERSION when no baseVersion and no tag exists yet", async () => {
  const githubClient = {
    getLatestTag: async () => null,
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(await client.next()).toBe("1.0.0");
});

test("next bumps patch when no baseVersion and a tag exists", async () => {
  const githubClient = {
    getLatestTag: async () => "1.3.2",
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(await client.next()).toBe("1.3.3");
});

test("next bumps patch when latest tag shares baseVersion's major/minor", async () => {
  const githubClient = {
    getLatestTag: async () => "1.0.0",
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(await client.next("1.0.0")).toBe("1.0.1");
});

test("next matches baseVersion without bumping when latest tag has a lower major/minor", async () => {
  const githubClient = {
    getLatestTag: async () => "0.9.5",
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(await client.next("1.0.0")).toBe("1.0.0");
});

test("next throws when baseVersion has a non-zero patch number", async () => {
  const githubClient = {
    getLatestTag: async () => null,
  } as unknown as GitHubClient;
  const client = new VersioningClient(
    githubClient,
    VersionUpdatingStrategy.NONE,
  );

  expect(client.next("1.0.1")).rejects.toThrow(
    "baseVersion has a non-zero patch number.",
  );
});
