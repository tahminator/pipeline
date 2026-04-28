import { XmlElement, XmlParser, XmlText } from "xml-trueformat";

import type { IJavaMavenVersioningClient } from "../../types";

import { BaseVersioningClient } from "../../base";

export class JavaMavenVersioningClient
  extends BaseVersioningClient
  implements IJavaMavenVersioningClient
{
  private getVersionNode(projectNode: XmlElement): XmlElement {
    const versionNode = projectNode.children.find(
      (child): child is XmlElement =>
        child instanceof XmlElement && child.tagName === "version",
    );

    if (!versionNode) {
      throw new Error(
        "Can't find version tag inside of project tag in pom.xml",
      );
    }

    return versionNode;
  }

  async update(version: string): Promise<void> {
    const files = await this.findFiles("pom.xml");

    for (const fileLocation of files) {
      const file = Bun.file(fileLocation);

      const oldPomStr = await file.text();
      const pom = XmlParser.parse(oldPomStr);
      const projectNode = pom.getRootElement();

      if (projectNode.tagName !== "project") {
        throw new Error("Can't find project tag inside of pom.xml");
      }

      const versionNode = this.getVersionNode(projectNode);

      versionNode.children = [new XmlText(version)];

      const newPomStr = pom.toString();

      await Bun.write(fileLocation, newPomStr);

      this.logFileLocationUpdated(fileLocation, version);
    }
  }
}
