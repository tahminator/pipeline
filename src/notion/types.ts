import type { UpdatePageParameters } from "@notionhq/client";

/**
 * Value accepted by Notion when updating a single page property, e.g. `{ checkbox: true }`.
 */
export type NotionPagePropertyUpdate = NonNullable<
  UpdatePageParameters["properties"]
>[string];

export type NotionClientOpts = {
  auth: {
    /**
     * Internal integration secret from https://www.notion.so/profile/integrations
     *
     * @note the integration must be added to the database via `...` -> `Connections`.
     */
    token: string;
  };
  /**
   * Database ID or URL, e.g. the 32-char ID in `https://www.notion.so/<workspace>/<databaseId>?v=...`
   */
  databaseId: string;
};
