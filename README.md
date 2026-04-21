<h1>
  <a href="https://www.npmjs.com/package/@tahminator/pipeline">
    <code>@tahminator/pipeline</code>
  </a>
</h1>

A collection of APIs built around Bun Shell that can be re-used in various CICD pipelines.

## Examples

- [`tahminator/instalock-web/.github/workflows`](https://github.com/tahminator/instalock-web/blob/main/.github), a monorepo with over 30k tracked users & 650 active in production.
- [`tahminator/sapling/.github/workflows`](https://github.com/tahminator/instalock-web/blob/main/.github), an Express library that makes backend development easier & less painful (used in `instalock-web`)
- [`tahminator/pipeline/src/internal`](https://github.com/tahminator/pipeline/blob/main/src/internal), which is used to help build, package & test this library

## Setup

To install dependencies:

```bash
bun install
```

To run:

```bash
# note not all dependencies may run directly in a local environment
bun run src/index.ts
```

> [!WARNING]
> This repository is iterating quickly & as such may have rough edges. I will always be happy to respond to & fix any issues anyone may have :)

## Available Clients

```ts
import {
  DockerClient,
  GitHubClient,
  NPMClient,
  SonarScannerClient,
  Utils,
} from "@tahminator/pipeline";
```

> [!NOTE]
> While there is documentation below, each API should be relatively well commented and be more up to date than what is seen below.

### `GitHubClient`

Interface with GitHub / GitHub Actions API

This client has two auth strategies: `createWithGithubAppToken()` and `createWithDefaultCiToken()`

**NOTE: If you want to automate pull requests, tags, or anything else that may trigger GitHub Actions, you must use `createWithGithubAppToken()`; there is no exception**

It is strongly recommended that you basically always use `createWithGithubAppToken()`

```ts
const client = await GitHubClient.createWithGithubAppToken({
  appId: process.env.GH_APP_ID!,
  privateKey: await Utils.decodeBase64EncodedString(
    process.env.GH_PRIVATE_KEY_B64!,
  ),
  installationId: process.env.GH_INSTALLATION_ID!,
});

// requires gh app
await client.createTag({
  releaseType: "patch", // default is patch
  // can also be automatically be inferred from env.GITHUB_REPOSITORY which is automatically injected in Actions
  repositoryOverride: ["tahminator", "my-service"],
});

await client.createTag({
  releaseType: "minor",
  onPreTagCreate: async (tag) => {
    // will set `version` key for all `package.json` excluding `node_modules/`
    await Utils.updateAllPackageJsonsWithVersion(tag);
    // you can write you own logic here if you would like
  },
});

// output to env.GITHUB_OUTPUT to re-use outputs across steps, jobs, outputs, etc.
// Hover over type in IDE to see more details
await client.outputToGithubOutput({
  ctx: {
    imageTag: "1.2.3",
    deploy: { env: "production", healthy: true },
  },
});

// updates kubernetes manifest repo. Hover over type of function and each key in argument in IDE to see more details
await client.updateK8sTagWithPR({
  newTag: "1.2.3",
  imageName: "tahminator/my-service",
  kustomizationFilePath: "apps/prod/kustomization.yaml",
  environment: "production",
  originRepo: ["tahminator", "pipeline"],
  manifestRepo: ["tahminator", "infra"],
});
```

```ts
// client cannot do most automations without getting skipped by CICD, but it can do many read operations and all CI operations just fine
const client = await GitHubClient.createWithDefaultCiToken();

await client.outputToGithubOutput({
  ctx: { imageTag: "1.2.3" },
});
```

### `DockerClient`

Interface with Docker to build & deploy images

```ts
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management
await using client = await DockerClient.create(
  process.env.DOCKER_USERNAME!,
  process.env.DOCKER_PAT!,
);

// `buildImage` will build AND deploy
await client.buildImage({
  dockerFileLocation: "./Dockerfile",
  dockerRepository: "my-service",
  tags: ["latest", "sha-abc123"], // define as many as you would like
  platforms: ["linux/amd64", "linux/arm64"], // build for multiple platforms
  buildArgs: { NODE_ENV: "production" }, // pass in build args
});

await client.buildImage({
  dockerFileLocation: "./Dockerfile",
  dockerRepository: "my-service",
  tags: ["local-dev"],
  shouldUpload: false, // dry run, do not actually upload
});

// find tag by given name,
await client.promoteDockerImage({
  repository: "my-service",
  originalTag: "sha-abc123",
  newGithubTags: ["staging", "1.2.3"],
});
```

### `NPMClient`

Interface with NPM registry in order to publish packages to `npmjs.com`

```ts
// uses trusted publishing, token based uploads are not supported
const npm = await NPMClient.create();

await npm.publish();

// dry run
await npm.publish(true);

// publish to the beta dist-tag instead of latest
// just like before, you should use `Utils.updateAllPackageJsonsWithVersion`
// with `Utils.SemVar.validate(betaTag)` to set a valid version
await npm.publish(false, true);
```

### `SonarScannerClient`

Interface with SonarQube and upload test coverage for basically any language / framework that is supported by Sonar Scanner.

```ts
import { $ } from "bun";

const backendClient = new SonarScannerClient({
  auth: {
    token: process.env.SONAR_TOKEN!,
  },
  run: {
    runTestsCmd: $`./mvnw clean verify -Dspring.profiles.active=ci`,
  },
  scan: {
    projectKey: "my-org_my-java-service",
    organization: "my-org",
    sourceCodeDir: "src/main/java",
    additionalArgs: { // all args are automatically wrapped in `-Dsonar.${key}=${value}`
      java.binaries: "target/classes",
      coverage.jacoco.xmlReportPaths: "target/site/jacoco/jacoco.xml",
    },
  },
});

await backendClient.runTests();
await backendClient.uploadTestCoverage();

const frontendClient = new SonarScannerClient({
  auth: {
    token: process.env.SONAR_TOKEN!,
  },
  run: {
    runTestsCmd: $`pnpm run --dir=js test`,
  },
  scan: {
    projectKey: "my-org_my-ts-service",
    organization: "my-org",
    sourceCodeDir: "js/src",
    additionalArgs: {
      javascript.lcov.reportPaths: "js/coverage/lcov.info",
    },
  },
});

await frontendClient.runTests();
await frontendClient.uploadTestCoverage();
```

### `Utils`

Assorted helper class used by clients and useful as an exported class to pipelines.

```ts
const githubPrivateKey = await Utils.decodeBase64EncodedString(
  process.env.GH_PRIVATE_KEY_B64!,
);

// will read from git-crypt encrypted variable so long as git-crypt & gpg are setup
// will only consume in memory
const env = await Utils.getEnvVariables(["shared", "production"], {
  baseDir: "apps/backend",
});

const shortId = Utils.generateShortId();

await Utils.updateAllPackageJsonsWithVersion("1.2.3");

if (await Utils.isCmdAvailable("gh")) {
  console.log(Utils.Colors.green(`gh is installed (${shortId})`));
}

if (Utils.Log.isDebug) {
  console.log(env.DATABASE_URL);
}
```
