import { $ } from "bun";

import { isCmdAvailable } from "../utils/cmd";

type SonarScannerOpts = {
  auth: {
    token: string;
  };
  run: {
    /**
     * Pass in a Bun command
     *
     * @example
     * ```
     * new SonarScannerClient({
     *   run: {
     *     runTestsCmd: $`./mvnw clean verify -Dspring.profiles.active=ci`
     *   }
     * })
     * ```
     */
    runTestsCmd: $.ShellPromise;
  };
  scan: {
    hostUrl?: string;
    /**
     * All args will be formated into `-Dsonar.${key}=${value}`
     */
    additionalArgs?: Record<string, string | number | boolean>;
    projectKey: string;
    organization: string;
    /**
     * Point this at where your source code files reside. e.g. `src/` or `src/java`
     */
    sourceCodeDir: string;
  };
};

/**
 * Provides a unified way to run tests & upload test coverage to a SonarQube instance.
 *
 * This client can be used to wire up test coverage for any language & environment; essentially, if SonarQube
 * supports it, this client can do it.
 */
export class SonarScannerClient {
  /**
   * Get `token`, `projectKey` & `organization` from https://sonarcloud.io/project/configuration/GitHubManual?id=<project_name>
   */
  constructor(private readonly opts: SonarScannerOpts) {}

  /**
   * Runs `opts.run.runTestsCmd`
   */
  async runTests(): Promise<void> {
    await this.opts.run.runTestsCmd;
  }

  /**
   * Upload test coverage to SonarQube.
   */
  async uploadTestCoverage(): Promise<void> {
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
