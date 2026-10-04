import { DefaultArtifactClient } from "@actions/artifact";

export class GitHubArtifactManager {
  private readonly client: DefaultArtifactClient;

  constructor() {
    this.client = new DefaultArtifactClient();
  }

  /**
   * Uploads `files` as an artifact of the current workflow run and returns a link to it.
   *
   * @note must run inside a GitHub Actions job with the runtime token exposed
   * (the `setup` action automatically exposes it).
   */
  async uploadArtifact({
    name,
    files,
    rootDirectory,
    retentionDays,
  }: {
    /**
     * must be unique within the workflow run
     */
    name: string;
    /**
     * absolute paths of the files to upload
     */
    files: string[];
    /**
     * paths inside the artifact are relative to this directory
     */
    rootDirectory: string;
    retentionDays?: number;
  }): Promise<{ id: number; url: string }> {
    const serverUrl = process.env.GITHUB_SERVER_URL;
    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    if (!serverUrl || !repository || !runId) {
      throw new Error(
        "uploadArtifact must run inside a GitHub Actions job (missing GITHUB_SERVER_URL, GITHUB_REPOSITORY or GITHUB_RUN_ID)",
      );
    }

    const { id } = await this.client.uploadArtifact(
      name,
      files,
      rootDirectory,
      { retentionDays },
    );
    if (id === undefined) {
      throw new Error(
        `Artifact ${name} was uploaded but GitHub returned no id`,
      );
    }

    return {
      id,
      url: `${serverUrl}/${repository}/actions/runs/${runId}/artifacts/${id}`,
    };
  }
}
