import {
  Client,
  extractDatabaseId,
  isFullDatabase,
  isFullDataSource,
  isFullPage,
} from "@notionhq/client";

import type { NotionClientOpts } from "./types";

import { NotionPageObject } from "./page";

type UniqueIdDataSource = {
  dataSourceId: string;
  /**
   * Name of the data source's `ID` (`unique_id`) property.
   */
  uniqueIdProperty: string;
};

/**
 * Interface with a single Notion database: look up its pages by their `ID` field & update their fields.
 *
 * @note the database must have exactly one data source with an `ID` (`unique_id`) property, since `ID`
 * values are only unique within a single data source.
 */
export class NotionClient {
  private readonly client: Client;
  private readonly databaseId: string;
  private dataSource?: Promise<UniqueIdDataSource>;

  constructor(opts: NotionClientOpts) {
    this.client = new Client({ auth: opts.auth.token });
    this.databaseId = extractDatabaseId(opts.databaseId) ?? opts.databaseId;
  }

  /**
   * Returns the page whose `ID` (`unique_id`) field equals `id`, or `null` if none exists.
   * For an ID displayed as `TASK-123`, pass `123`.
   */
  async getPageByUniqueId(id: number): Promise<NotionPageObject | null> {
    const { dataSourceId, uniqueIdProperty } = await this.getDataSource();

    const { results } = await this.client.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: uniqueIdProperty,
        unique_id: { equals: id },
      },
      page_size: 1,
    });

    const page = results.find(isFullPage);
    return page ? new NotionPageObject(this.client, page) : null;
  }

  private getDataSource(): Promise<UniqueIdDataSource> {
    this.dataSource ??= this.resolveDataSource().catch((e: unknown) => {
      this.dataSource = undefined;
      throw e;
    });
    return this.dataSource;
  }

  private async resolveDataSource(): Promise<UniqueIdDataSource> {
    const database = await this.client.databases.retrieve({
      database_id: this.databaseId,
    });
    if (!isFullDatabase(database)) {
      throw new Error(
        `Notion database ${this.databaseId} is not accessible by this integration`,
      );
    }

    const dataSources = await Promise.all(
      database.data_sources.map(({ id }) =>
        this.client.dataSources.retrieve({ data_source_id: id }),
      ),
    );

    const resolved = dataSources.flatMap((dataSource) => {
      if (!isFullDataSource(dataSource)) return [];

      const uniqueIdProperty = Object.values(dataSource.properties).find(
        (property) => property.type === "unique_id",
      );
      return uniqueIdProperty ?
          [
            {
              dataSourceId: dataSource.id,
              uniqueIdProperty: uniqueIdProperty.name,
            },
          ]
        : [];
    });

    const [only, ...rest] = resolved;
    if (!only) {
      throw new Error(
        `Notion database ${this.databaseId} has no "ID" (unique_id) property`,
      );
    }
    if (rest.length > 0) {
      throw new Error(
        `Notion database ${this.databaseId} has ${resolved.length} data sources with an "ID" (unique_id) property; exactly one is supported`,
      );
    }

    return only;
  }
}
