import { $ } from "bun";

import { isCmdAvailable } from "../utils/cmd";

type SonarScannerOpts = {
  auth: {
    token: string;
  };
  run: {
    runTestsCmd: $.ShellPromise;
  };
  scan: {
    hostUrl?: string;
    additionalArgs?: Record<string, string | number | boolean>;
    projectKey: string;
    organization: string;
    sourceCodeDir: string;
  };
};

/**
 * @beta WIP
 */
export class SonarScannerClient {
  private constructor(private readonly opts: SonarScannerOpts) {}

  async runTests(): Promise<void> {
    await this.opts.run.runTestsCmd;
  }

  async uploadTests(): Promise<void> {
    if (!(await isCmdAvailable("sonar"))) {
      console.log("Sonar is missing, installing globally via NPM...");
      await $`npm i -g @sonar/scan`;
    }

    const { auth, scan } = this.opts;

    const args = [
      `-Dsonar.host.url=${scan.hostUrl ?? "https://sonarcloud.io"}`,
      `-Dsonar.token=${auth.token}`,
      `-Dsonar.projectKey=${scan.projectKey}`,
      `-Dsonar.organization=${scan.organization}`,
      `-Dsonar.sources=${scan.sourceCodeDir}`,
      ...Object.entries(scan.additionalArgs ?? {}).map(
        ([k, v]) => `-Dsonar.${k}=${v}`,
      ),
    ];

    await $`sonar ${args}`;
  }
}
