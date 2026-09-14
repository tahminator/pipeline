import { $ } from "bun";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import semver from "semver";

import type {
  ProtobufArtifactKeeperBackend,
  ProtobufGoTargetLanguageOptions,
} from "../types";

import { isCmdAvailable } from "../../utils/cmd";

type GoModule = {
  modulePath: string;
  version: string;
};

type GoModuleArtifact = {
  extension: "mod" | "zip";
  filePath: string;
  contentType: string;
};

/** Publishes Buf's import-path output as a hosted Go proxy module. */
export class ArtifactKeeperGoPublisher {
  constructor(private readonly config: ProtobufArtifactKeeperBackend) {}

  async publish({
    generatedDirectory,
    options,
  }: {
    generatedDirectory: string;
    options: ProtobufGoTargetLanguageOptions;
  }): Promise<void> {
    const version = this.normalizeVersion(options.version);
    await this.requireToolchains();
    const modulePath = await this.inferModulePath(generatedDirectory);
    this.validateModuleVersion(modulePath, version);

    const module: GoModule = { modulePath, version };
    const stagingDirectory = await mkdtemp(path.join(tmpdir(), "protobuf-go-"));
    try {
      const moduleDirectory = await this.stageModule(
        module,
        generatedDirectory,
        stagingDirectory,
      );
      const artifacts = await this.packageModule(
        module,
        moduleDirectory,
        stagingDirectory,
      );
      for (const artifact of artifacts) {
        await this.uploadArtifact(module, artifact);
      }
    } finally {
      await rm(stagingDirectory, { force: true, recursive: true });
    }
  }

  private normalizeVersion(value: string): string {
    const version = `v${value.replace(/^v/, "")}`;
    if (!semver.valid(version) || version.includes("+")) {
      throw new Error(
        "Go publishing requires a semantic version without build metadata.",
      );
    }
    return version;
  }

  private async requireToolchains(): Promise<void> {
    for (const command of ["go", "zip"]) {
      if (!(await isCmdAvailable(command))) {
        throw new Error(`Go publishing requires ${command} on PATH.`);
      }
    }
  }

  private async inferModulePath(generatedDirectory: string): Promise<string> {
    const packages = await this.findPackageDirectories(generatedDirectory);
    const prefix = packages[0]?.split("/") ?? [];
    for (const directory of packages.slice(1)) {
      const segments = directory.split("/");
      while (prefix.some((segment, index) => segment !== segments[index])) {
        prefix.pop();
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (prefix.length < 2 || !prefix[0]!.includes(".")) {
      throw new Error(
        "Generated go_package paths must share a module prefix containing a domain and path.",
      );
    }
    return prefix.join("/");
  }

  private async findPackageDirectories(
    directory: string,
    relativeDirectory = "",
  ): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const packages: string[] = [];
    if (entries.some((entry) => entry.isFile() && entry.name.endsWith(".go"))) {
      packages.push(relativeDirectory);
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        packages.push(
          ...(await this.findPackageDirectories(
            path.join(directory, entry.name),
            relativeDirectory ?
              `${relativeDirectory}/${entry.name}`
            : entry.name,
          )),
        );
      }
    }
    return packages;
  }

  private validateModuleVersion(modulePath: string, version: string): void {
    const major = semver.major(version);
    const pathMajor =
      modulePath.match(/\/v([0-9]+)$/)?.[1] ??
      (modulePath.startsWith("gopkg.in/") ?
        modulePath.match(/\.v([0-9]+)$/)?.[1]
      : undefined);
    if (
      (pathMajor &&
        !modulePath.startsWith("gopkg.in/") &&
        Number(pathMajor) < 2) ||
      (pathMajor && Number(pathMajor) !== major) ||
      (!pathMajor && major >= 2)
    ) {
      throw new Error(
        `Go module path ${modulePath} does not match version ${version}.`,
      );
    }
  }

  private async stageModule(
    module: GoModule,
    generatedDirectory: string,
    stagingDirectory: string,
  ): Promise<string> {
    // Buf's default paths=import layout includes the full go_package import path.
    // Strip only the module prefix, without modifying the original output.
    const sourceDirectory = path.join(generatedDirectory, module.modulePath);
    const moduleDirectory = path.join(
      stagingDirectory,
      this.archiveRoot(module),
    );
    await mkdir(path.dirname(moduleDirectory), { recursive: true });
    await cp(sourceDirectory, moduleDirectory, { recursive: true });
    await this.shell`go mod init ${module.modulePath}`.cwd(moduleDirectory);
    return moduleDirectory;
  }

  private async packageModule(
    module: GoModule,
    moduleDirectory: string,
    stagingDirectory: string,
  ): Promise<GoModuleArtifact[]> {
    // Resolve dependency metadata; generated code is not linted or tested.
    await this.shell`go mod tidy`.cwd(moduleDirectory);
    const archivePath = path.join(stagingDirectory, "module.zip");
    const archiveRoot = this.archiveRoot(module);
    await this
      .shell`zip -q -r ${archivePath} ${archiveRoot} -i ${`${archiveRoot}/*`}`.cwd(
      stagingDirectory,
    );
    return [
      {
        extension: "mod",
        filePath: path.join(moduleDirectory, "go.mod"),
        contentType: "text/plain",
      },
      {
        extension: "zip",
        filePath: archivePath,
        contentType: "application/zip",
      },
    ];
  }

  private async uploadArtifact(
    module: GoModule,
    artifact: GoModuleArtifact,
  ): Promise<void> {
    const url = `${this.repositoryUrl}/${this.escapeProxyPath(module.modulePath)}/@v/${this.escapeProxyPath(module.version)}.${artifact.extension}`;
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.token}`,
    ).toString("base64");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": artifact.contentType,
      },
      body: Bun.file(artifact.filePath),
      redirect: "error",
    });
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(
        `Go ${artifact.extension} upload failed: HTTP ${response.status}`,
      );
    }
  }

  private archiveRoot(module: GoModule): string {
    return `${module.modulePath}@${module.version}`;
  }

  private escapeProxyPath(value: string): string {
    // Go proxy URLs escape uppercase letters; archive entries do not.
    return value.replace(/[A-Z]/g, (letter) => `!${letter.toLowerCase()}`);
  }

  private get repositoryUrl(): string {
    return `${this.config.url.replace(/\/$/, "")}/go/go`;
  }

  private get shell() {
    return $.env({ ...process.env, GOWORK: "off" });
  }
}
