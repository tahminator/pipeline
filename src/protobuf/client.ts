import { $ } from "bun";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import yaml from "yaml";

import { isCmdAvailable } from "../utils/cmd";
import { createProtobufCompilerBackendStrategy } from "./backend";
import {
  GoProtobufTargetLanguageStrategy,
  type IProtobufTargetLanguageStrategy,
  JavaProtobufTargetLanguageStrategy,
  RustProtobufTargetLanguageStrategy,
} from "./strategy";
import {
  type ProtobufCompilerCompileArgs,
  type ProtobufCompilerCompileResult,
  type ProtobufTargetLanguageOptions,
  type ProtobufTargetLanguages,
  ProtobufTargetLanguage,
} from "./types";

type BufGenerateInput = {
  input: string;
  pathFilter?: string;
};

type CompilationTarget = {
  language: ProtobufTargetLanguage;
  options: ProtobufTargetLanguageOptions;
  strategy: IProtobufTargetLanguageStrategy;
};

const TARGET_LANGUAGE_STRATEGY_FACTORIES: Record<
  ProtobufTargetLanguage,
  (targets: ProtobufTargetLanguages) => IProtobufTargetLanguageStrategy
> = {
  [ProtobufTargetLanguage.JAVA]: (targets) =>
    new JavaProtobufTargetLanguageStrategy(
      targets[ProtobufTargetLanguage.JAVA]?.protobufJavaVersion,
    ),
  [ProtobufTargetLanguage.GO]: () => new GoProtobufTargetLanguageStrategy(),
  [ProtobufTargetLanguage.RUST]: (targets) =>
    new RustProtobufTargetLanguageStrategy(
      targets[ProtobufTargetLanguage.RUST]?.prostVersion,
    ),
};

export class ProtobufCompilerClient {
  async compile({
    backend,
    bufToken,
    targetLanguages,
    protoFilesLocation,
    outputDirectory,
  }: ProtobufCompilerCompileArgs): Promise<ProtobufCompilerCompileResult> {
    const targets = this.getCompilationTargets(targetLanguages);
    await this.requireToolchains(targets);

    const outputDirectoryPath = path.resolve(
      outputDirectory ??
        (await mkdtemp(path.join(tmpdir(), "protobuf-compiler-"))),
    );
    const compilerBackend =
      backend ? createProtobufCompilerBackendStrategy(backend) : undefined;

    await mkdir(outputDirectoryPath, { recursive: true });
    await this.generateWithBuf({
      bufToken,
      outputDirectory: outputDirectoryPath,
      protoFilesLocation,
      targetStrategies: targets.map(({ strategy }) => strategy),
    });

    const generatedDirectories: ProtobufCompilerCompileResult["generatedDirectories"] =
      {};
    for (const { language, strategy } of targets) {
      generatedDirectories[language] = path.join(
        outputDirectoryPath,
        strategy.outputDirectoryName,
      );
    }

    if (compilerBackend) {
      for (const { language, options } of targets) {
        const generatedDirectory = generatedDirectories[language];
        if (!generatedDirectory) {
          throw new Error("Generated code directory was not created.");
        }

        await compilerBackend.publish({
          generatedDirectory,
          options,
          targetLanguage: language,
        });
      }
    }

    return { generatedDirectories, outputDirectory: outputDirectoryPath };
  }

  async installToolchains(targets: CompilationTarget[] = []): Promise<void> {
    await this.requireToolchains(targets);
  }

  private async requireToolchains(targets: CompilationTarget[]): Promise<void> {
    /*
     * Use local protoc plugins, not Buf remote plugins.
     * This keeps proto source code off BSR servers.
     * The setup action installs these tools in CI.
     */
    const requiredCommands = [
      "buf",
      ...new Set(
        targets.flatMap(({ strategy }) => strategy.requiredCommands ?? []),
      ),
    ];

    for (const command of requiredCommands) {
      if (await isCmdAvailable(command)) continue;

      throw new Error(
        `${command} is required for local protobuf generation. ` +
          "Enable INSTALL_PROTO_DEPENDENCIES in the setup action, or install the tool on PATH.",
      );
    }
  }

  private async generateWithBuf({
    bufToken,
    protoFilesLocation,
    outputDirectory,
    targetStrategies,
  }: {
    bufToken: string | undefined;
    protoFilesLocation: string;
    outputDirectory: string;
    targetStrategies: IProtobufTargetLanguageStrategy[];
  }): Promise<void> {
    const templateDirectory = await mkdtemp(
      path.join(tmpdir(), "protobuf-buf-template-"),
    );
    const templatePath = path.join(templateDirectory, "buf.gen.yaml");
    const { input, pathFilter } =
      await this.getBufGenerateInput(protoFilesLocation);
    const pathFlag = pathFilter ? ["--path", pathFilter] : [];

    /*
     * Write a temporary Buf template.
     * This lets callers choose languages without a checked-in buf.gen.yaml.
     */
    await writeFile(
      templatePath,
      yaml.stringify({
        version: "v2",
        plugins: targetStrategies.flatMap((strategy) =>
          strategy.plugins.map((plugin) => ({
            ...plugin,
            out: strategy.outputDirectoryName,
            include_imports: true,
          })),
        ),
      }),
    );

    try {
      const command =
        bufToken ?
          $.env({
            ...process.env,
            BUF_TOKEN: bufToken,
          })`buf generate ${input} --template ${templatePath} ${pathFlag}`.cwd(
            outputDirectory,
          )
        : $`buf generate ${input} --template ${templatePath} ${pathFlag}`.cwd(
            outputDirectory,
          );

      await command;
    } finally {
      await rm(templateDirectory, { force: true, recursive: true });
    }
  }

  private getCompilationTargets(
    targetLanguages: ProtobufTargetLanguages,
  ): CompilationTarget[] {
    return this.getConfiguredTargetLanguages(targetLanguages).map(
      ([language, options]) => ({
        language,
        options,
        strategy: TARGET_LANGUAGE_STRATEGY_FACTORIES[language](targetLanguages),
      }),
    );
  }

  private getConfiguredTargetLanguages(
    targetLanguages: ProtobufTargetLanguages,
  ): [ProtobufTargetLanguage, ProtobufTargetLanguageOptions][] {
    return Object.entries(targetLanguages).flatMap(([language, options]) =>
      options ? [[Number(language) as ProtobufTargetLanguage, options]] : [],
    );
  }

  private async getBufGenerateInput(
    protoFilesLocation: string,
  ): Promise<BufGenerateInput> {
    /*
     * If the input is inside a Buf module, run Buf at the module root.
     * Then add --path for the selected file.
     * This lets imports resolve correctly.
     */
    const resolvedLocation = path.resolve(protoFilesLocation);
    const stats = await Bun.file(resolvedLocation).stat();

    if (stats.isFile() && !resolvedLocation.endsWith(".proto")) {
      throw new Error(`${protoFilesLocation} is not a .proto file.`);
    }

    const sourceDirectory =
      stats.isFile() ? path.dirname(resolvedLocation) : resolvedLocation;
    const moduleDirectory =
      (await this.findBufModuleDirectory(sourceDirectory)) ?? sourceDirectory;
    return {
      input: moduleDirectory,
      pathFilter:
        moduleDirectory === resolvedLocation ? undefined : resolvedLocation,
    };
  }

  private async findBufModuleDirectory(
    directory: string,
  ): Promise<string | null> {
    let currentDirectory = path.resolve(directory);

    while (true) {
      if (await Bun.file(path.join(currentDirectory, "buf.yaml")).exists()) {
        return currentDirectory;
      }

      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        return null;
      }

      currentDirectory = parentDirectory;
    }
  }
}
