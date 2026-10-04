import type { Client, PageObjectResponse } from "@notionhq/client";

import { isFullPage } from "@notionhq/client";

import type { NotionPagePropertyUpdate } from "./types";

/**
 * Wraps a single Notion page (a row in a database) and allows reading & updating its fields.
 */
export class NotionPageObject {
  constructor(
    private readonly client: Client,
    private page: PageObjectResponse,
  ) {}

  get id(): string {
    return this.page.id;
  }

  get url(): string {
    return this.page.url;
  }

  /**
   * Raw property values of the page, keyed by field name. Reflects the latest successful `saveField`.
   */
  get properties(): PageObjectResponse["properties"] {
    return this.page.properties;
  }

  /**
   * @returns `true` if the page has a field (property) named `name`.
   */
  hasField(name: string): boolean {
    return Object.hasOwn(this.page.properties, name);
  }

  /**
   * Persist a new value for the field `name` to Notion.
   *
   * @example
   * ```ts
   * await page.saveField("Status", { status: { name: "Done" } });
   * await page.saveField("PR", { url: "https://github.com/tahminator/pipeline/pull/1" });
   * ```
   *
   * @throws if the page has no field named `name`.
   */
  async saveField(
    name: string,
    value: NotionPagePropertyUpdate,
  ): Promise<void> {
    if (!this.hasField(name)) {
      throw new Error(
        `Notion page ${this.page.id} has no field named "${name}"`,
      );
    }

    const updated = await this.client.pages.update({
      page_id: this.page.id,
      properties: { [name]: value },
    });

    if (isFullPage(updated)) {
      this.page = updated;
    }
  }
}
