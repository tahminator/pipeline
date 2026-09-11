import type { Octokit } from "@octokit/rest";

import yaml from "yaml";

import type { Environment, OwnerString, RepoString } from "../../types";

import { Utils } from "../../utils";
import { kustomizeSchema } from "./schema";

type CheckRunStatus = "queued" | "in_progress" | "completed";

type CheckRunConclusion =
  | "action_required"
  | "cancelled"
  | "failure"
  | "neutral"
  | "success"
  | "skipped"
  | "stale"
  | "timed_out";

type CheckRunOutput = {
  title: string;
  summary: string;
  text?: string;
};

type WriteStatusCheckArgs =
  | {
      action: "create";
      owner: string;
      repository: string;
      /**
       * commit sha the check run applies to
       */
      sha: string;
      name: string;
      status?: CheckRunStatus;
      conclusion?: CheckRunConclusion;
      output?: CheckRunOutput;
      detailsUrl?: string;
    }
  | {
      action: "update";
      owner: string;
      repository: string;
      checkRunId: number;
      status?: CheckRunStatus;
      conclusion?: CheckRunConclusion;
      output?: CheckRunOutput;
      detailsUrl?: string;
    };

export class GitHubPRManager {
  constructor(private readonly client: Octokit) {}

  async updateK8sTagWithPR({
    newTag,
    imageName,
    kustomizationFilePath,
    environment,
    originRepo,
    manifestRepo,
  }: {
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

    const { data: repo } = await this.client.rest.repos.get({
      owner: manifestOwner,
      repo: manifestRepository,
    });

    const baseBranch = repo.default_branch;

    const { data: ref } = await this.client.rest.git.getRef({
      owner: manifestOwner,
      repo: manifestRepository,
      ref: `heads/${baseBranch}`,
    });

    await this.client.rest.git.createRef({
      owner: manifestOwner,
      repo: manifestRepository,
      ref: `refs/heads/${newBranchName}`,
      sha: ref.object.sha,
    });

    const { data: file } = await this.client.rest.repos.getContent({
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

    await this.client.rest.repos.createOrUpdateFileContents({
      owner: manifestOwner,
      repo: manifestRepository,
      path: kustomizationFilePath,
      message: `deploy: update ${imageName} to ${newTag}`,
      content: Buffer.from(updatedYaml).toString("base64"),
      sha: file.sha,
      branch: newBranchName,
    });

    const { data: pr } = await this.client.rest.pulls.create({
      owner: manifestOwner,
      repo: manifestRepository,
      title: `Deploying ${newTag} for ${imageName} in ${environment}`,
      head: newBranchName,
      base: baseBranch,
      body: `Automated image tag change to ${newTag} for ${imageName} in ${environment} triggered by [${originOwner}/${originRepository}](https://github.com/${originOwner}/${originRepository}).`,
    });

    await this.mergePr({
      prId: pr.number,
      owner: manifestOwner,
      repository: manifestRepository,
    });
  }

  async mergePr({
    prId,
    owner,
    repository,
    mergeMethod = "squash",
  }: {
    prId: number;
    owner: string;
    repository: string;
    mergeMethod?: "merge" | "squash" | "rebase";
  }) {
    await this.client.rest.pulls.merge({
      owner,
      repo: repository,
      pull_number: prId,
      merge_method: mergeMethod,
    });
  }

  async writeStatusCheck(args: WriteStatusCheckArgs) {
    switch (args.action) {
      case "create": {
        const {
          owner,
          repository,
          sha,
          name,
          status,
          conclusion,
          output,
          detailsUrl,
        } = args;

        const { data } = await this.client.rest.checks.create({
          owner,
          repo: repository,
          head_sha: sha,
          name,
          status,
          conclusion,
          output,
          details_url: detailsUrl,
        });

        return data;
      }
      case "update": {
        const {
          owner,
          repository,
          checkRunId,
          status,
          conclusion,
          output,
          detailsUrl,
        } = args;

        const { data } = await this.client.rest.checks.update({
          owner,
          repo: repository,
          check_run_id: checkRunId,
          status,
          conclusion,
          output,
          details_url: detailsUrl,
        });

        return data;
      }
    }
  }

  async sendPrMessage({
    prId,
    owner,
    repository,
    message,
  }: {
    prId: number;
    owner: string;
    repository: string;
    message: string;
  }) {
    await this.client.rest.issues.createComment({
      issue_number: prId,
      owner,
      repo: repository,
      body: message,
    });
  }
}
