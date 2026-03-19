import { $ } from "bun";

import { Utils } from "../utils";

export class DockerClient {
  private constructor(private readonly username: string) {}

  /**
   * @note This class must be cleaned up manually by calling `cleanup()`.
   * You can also do this manually by utilizing the [`usage`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management) keyword.
   *
   * @example
   * ```ts
   * export async function main() {
   *    await using client = await DockerClient.create(username, pat);
   *
   *    client.promoteDockerImage({});
   *
   *    // client will automatically be cleaned up at the end of the scope.
   * }
   * ```
   */
  static async create(username: string, pat: string): Promise<DockerClient> {
    const client = new DockerClient(username);
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
  }): Promise<void> {
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

  async buildImage(args: {
    dockerFileLocation: string;
    /**
     * @example ["staging-latest", `staging-${sha}`, `staging-%{timestamp.toString()}`]
     */
    tags: string[];
    dockerUsername: string;
    dockerRepository: string;
    shouldUpload?: boolean;
    platforms?: string[];
    buildArgs?: Record<string, string | number | boolean>;
  }): Promise<void> {
    const {
      dockerFileLocation,
      tags,
      dockerUsername,
      dockerRepository,
      shouldUpload = true,
      platforms = ["linux/amd64"],
      buildArgs = {},
    } = args;

    if (!tags.length) {
      throw new Error("You must provide atleast one tag.");
    }

    console.log("Building image with following tags:");
    tags.forEach((tag) => console.log(Utils.Colors.cyan(tag)));

    try {
      await $`docker buildx create --use --name ${dockerRepository}-builder`;
    } catch {
      await $`docker buildx use ${dockerRepository}-builder`;
    }

    const buildModeFlag = shouldUpload ? "--push" : "--load";
    const tagFlags = tags.flatMap((tag) => [
      "--tag",
      `${dockerUsername}/${dockerRepository}:${tag}`,
    ]);
    const buildArgFlags = Object.entries(buildArgs).flatMap(([k, v]) => [
      "--build-arg",
      `${k}=${v.toString()}`,
    ]);

    await $`docker buildx build ${buildModeFlag} \
              --platform ${platforms.join(",")} \
              --file ${dockerFileLocation} \
              --cache-from=type=gha \
              --cache-to=type=gha,mode=max \
              ${buildArgFlags} \
              ${tagFlags} \
              .`;

    console.log(
      shouldUpload ?
        `Image build & successfully uploaded to ${dockerUsername}/${dockerRepository}`
      : "Image has been built (upload skipped.)",
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    await $`docker logout`;
  }
}
