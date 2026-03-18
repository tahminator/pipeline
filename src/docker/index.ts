import { $ } from "bun";

export class DockerClient {
  private constructor(
    private readonly username: string,
    private readonly pat: string,
  ) {}

  static async create(username: string, pat: string): Promise<DockerClient> {
    const client = new DockerClient(username, pat);
    await $`echo ${pat} | docker login -u ${username} --password-stdin`;
    return client;
  }

  /**
   * Will lookup the Docker Hub image of `originalTag` & add `newGithubTags` to it.
   */
  async promoteDockerImage({
    originalTag,
    newGithubTags,
    repository,
  }: {
    originalTag: string;
    newGithubTags: string[];
    repository: string;
  }) {
    const fullRepo = `${this.username}/${repository}`;
    const oldImage = `${fullRepo}:${originalTag}`;

    await $`docker pull ${oldImage}`;

    for (const tag of newGithubTags) {
      const newImage = `${fullRepo}:${tag}`;
      console.log(`Promoting to ${newImage}...`);

      await $`docker tag ${oldImage} ${newImage}`;
      await $`docker push ${newImage}`;
    }

    console.log(`Promoted ${originalTag} to: ${newGithubTags.join(", ")}`);
  }

  async cleanup() {
    await $`docker logout`;
  }
}
