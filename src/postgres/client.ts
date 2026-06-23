import { $, randomUUIDv7 } from "bun";

import type { PostgresInternalState, PostgresState } from "./types";

import { Utils } from "../utils";

export class LocalPostgresClient {
  private constructor(private readonly iState: PostgresInternalState) {}

  /**
   * Spin up a local Postgres instance via Docker.
   *
   * @example
   * ```ts
      async function main() {
        await using pgClient = await LocalPostgresClient.create({
          database: "instalock-server-acceptance",
        });

        // get credentials 
        const { database, host, port, password, user } = pgClient.state;

        $.env({
          ...process.env,
          DB_HOST: host,
          DB_PORT: String(port),
          DB_NAME: database,
          DB_USERNAME: user,
          DB_PASSWORD: password,
        })`just migrate`

        // `pgClient` will be automatically cleaned up at the end of the scope.
      }
   * ```
   */
  static async create(state: PostgresState): Promise<LocalPostgresClient> {
    const iState: PostgresInternalState = {
      ...state,
      user: "postgres",
      password: "postgres",
      port: 5432,
      host: "127.0.0.1",
      dockerName: `local-db-${randomUUIDv7()}`,
    };

    const hostPort = await this.launch(iState);
    iState.port = hostPort;
    await this.waitUntilReady(iState);

    return new this(iState);
  }

  private static async launch(iState: PostgresInternalState): Promise<number> {
    await $`docker run -d \
        --name ${iState.dockerName} \
        -e POSTGRES_USER=${iState.user} \
        -e POSTGRES_PASSWORD=${iState.password} \
        -e POSTGRES_DB=${iState.database} \
        -p 5432 \
        mirror.gcr.io/library/postgres:16-alpine`;

    const raw = (
      await $`docker port ${iState.dockerName} 5432/tcp`.text()
    ).trim();
    const match = raw.match(/:(\d+)/);
    if (!match) {
      throw new Error(`Could not parse host port from: ${raw}`);
    }
    return Number(match[1]);
  }

  private static async waitUntilReady(iState: PostgresInternalState) {
    console.log(`Waiting for ${iState.dockerName} to become ready.`);

    const attempts = 30;
    const ready = await Utils.waitUntil({
      attempts,
      intervalMs: 2000,
      predicate: async (attempt) => {
        const check =
          await $`docker exec ${iState.dockerName} pg_isready -U ${iState.user}`
            .quiet()
            .nothrow();

        if (check.exitCode === 0) {
          return true;
        }

        console.log(
          `Waiting for ${iState.dockerName}... (${attempt}/${attempts})`,
        );
        return false;
      },
    });

    if (!ready) {
      const msg = `${iState.dockerName} failed to launch`;
      console.error(msg);
      throw new Error(msg);
    }

    console.log(`${iState.dockerName} is ready`);
  }

  get state(): PostgresInternalState {
    return this.iState;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    console.log(`Stopping and removing ${this.iState.dockerName} container...`);

    if (Utils.Log.isDebug) {
      console.log(
        Utils.Colors.brightMagenta(`=== ${this.iState.dockerName} LOGS ===`),
      );
      const logs = await $`docker logs ${this.iState.dockerName}`.text();
      logs
        .split("\n")
        .filter((s) => s.length > 0)
        .forEach((line) => console.log(Utils.Colors.brightMagenta(line)));
      console.log(
        Utils.Colors.brightMagenta(
          `=== ${this.iState.dockerName} LOGS END ===`,
        ),
      );
    }

    await $`docker stop ${this.iState.dockerName}`.quiet().nothrow();
    await $`docker rm ${this.iState.dockerName}`.quiet().nothrow();
  }
}
