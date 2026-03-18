import type { Octokit } from "@octokit/rest";
import type { Environment, OwnerString, RepoString } from "../../types";
import { kustomizeSchema } from "./schema";
import yaml from "yaml";
import { Utils } from "../../utils";

export class GitHubPRManager {
  constructor(private readonly client: Octokit) {}

  /**
   *
   * update k8s manifest repo with new tag version.
   *
   * @note `kustomizationFile` must look like this:
   *
   * ```yaml
   * apiVersion: kustomize.config.k8s.io/v1beta1
   * kind: Kustomization
   * resources:
   *   - deployment.yaml
   *   - secrets.yaml
   *   - service.yaml
   *   - monitor.yaml
   * commonLabels:
   *   app: instalock-web
   *   environment: production
   * # This part specifically
   * images:
   *   - name: tahminator/instalock-web
   *     newTag: a70ee0e
   * ```
   */
  async updateK8sTagWithPR({
    client,
    newTag,
    imageName,
    kustomizationFilePath,
    environment,
    originRepo,
    manifestRepo,
  }: {
    client: Octokit;
    newTag: string;
    imageName: string;
    kustomizationFilePath: string;
    environment: Environment;
    originRepo: [OwnerString, RepoString];
    manifestRepo: [OwnerString, RepoString];
  }) {
    const [manifestOwner, manifestRepository] = manifestRepo;
    const [originOwner, originRepository] = originRepo;

    const newBranchName = `${imageName}-${newTag}-${Utils.generateShortId()}`;

    const { data: repo } = await client.rest.repos.get({
      owner: manifestOwner,
      repo: manifestRepository,
    });

    const baseBranch = repo.default_branch;

    const { data: ref } = await client.rest.git.getRef({
      owner: manifestOwner,
      repo: manifestRepository,
      ref: `heads/${baseBranch}`,
    });

    await client.rest.git.createRef({
      owner: manifestOwner,
      repo: manifestRepository,
      ref: `refs/heads/${newBranchName}`,
      sha: ref.object.sha,
    });

    const { data: file } = await client.rest.repos.getContent({
      owner: manifestOwner,
      repo: manifestRepository,
      path: kustomizationFilePath,
      ref: newBranchName,
    });

    if (Array.isArray(file)) throw new Error("Unexpected file shape found");

    if (!file) throw new Error("Kustomization file not found");
    if (file.type !== "file") throw new Error("Unexpected file type found");
    if (!file.content) throw new Error("Kustomization file is empty");

    const currentYaml = Buffer.from(file.content ?? "", "base64").toString();
    const doc = yaml.parseDocument(currentYaml);

    const yamlObj = kustomizeSchema.parse(doc.toJS());

    const targetImage = yamlObj.images?.find((img) => img.name === imageName);

    if (!targetImage) {
      console.debug(yamlObj);
      throw new Error("Target image could not be found.");
    }

    targetImage.newTag = newTag;

    doc.set("images", yamlObj.images);

    const updatedYaml = doc.toString();

    await client.rest.repos.createOrUpdateFileContents({
      owner: manifestOwner,
      repo: manifestRepository,
      path: kustomizationFilePath,
      message: `deploy: update ${imageName} to ${newTag}`,
      content: Buffer.from(updatedYaml).toString("base64"),
      sha: file.sha,
      branch: newBranchName,
    });

    const { data: pr } = await client.rest.pulls.create({
      owner: manifestOwner,
      repo: manifestRepository,
      title: `Deploying ${newTag} for ${imageName} in ${environment}`,
      head: newBranchName,
      base: baseBranch,
      body: `Automated image tag change to ${newTag} for ${imageName} in ${environment} triggered by [${originOwner}/${originRepository}](https://github.com/${originOwner}/${originRepository}).`,
    });

    await client.rest.pulls.merge({
      owner: manifestOwner,
      repo: manifestRepository,
      pull_number: pr.number,
      merge_method: "squash",
    });
  }
}
