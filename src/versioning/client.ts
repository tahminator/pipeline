import { JavaMavenVersioningClient } from "./java/maven";
import { JavascriptPackageJsonVersioningClient } from "./jsts";
import { VersioningStrategy, type IVersioningClient } from "./types";

export class VersioningClient implements IVersioningClient {
  private readonly delegate: IVersioningClient;

  constructor(strategy: VersioningStrategy) {
    this.delegate = this.getDelegate(strategy);
  }

  private getDelegate(strategy: VersioningStrategy) {
    switch (strategy) {
      case VersioningStrategy.JSTS:
        return new JavascriptPackageJsonVersioningClient();
      case VersioningStrategy.JAVA_MAVEN:
        return new JavaMavenVersioningClient();
    }
  }

  async update(version: string): Promise<void> {
    await this.delegate.update(version);
  }
}
