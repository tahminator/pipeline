import type { Octokit } from "@octokit/rest";

export class GitHubTeamManager {
  constructor(private readonly client: Octokit) {}

  /**
   * Confirms whether the given user is an active member of a team within an org.
   *
   * @note this only returns `true` for `active` memberships. A user with a `pending`
   * invite (has not accepted yet) will return `false`.
   */
  async isTeamMember({
    org,
    teamSlug,
    username,
  }: {
    org: string;
    teamSlug: string;
    username: string;
  }): Promise<boolean> {
    try {
      const { data } = await this.client.rest.teams.getMembershipForUserInOrg({
        org,
        team_slug: teamSlug,
        username,
      });

      return data.state === "active";
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "status" in e &&
        (e as { status: unknown }).status === 404
      ) {
        return false;
      }

      throw e;
    }
  }
}
