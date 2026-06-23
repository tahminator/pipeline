import { $, randomUUIDv7 } from "bun";

import type { RedisInternalState, RedisState } from "./types";

import { Utils } from "../utils";

export class LocalRedisClient {
  private constructor(private readonly iState: RedisInternalState) {}

  /**
   * Spin up a local Redis instance via Docker.
   *
   * @example
   * ```ts
      async function main() {
        await using redisClient = await LocalRedisClient.create();

        // get credentials 
        const {
          port,
          password,
          host,
        } = redisClient.state;

        $.env({
          ...process.env,
          REDISHOST: host,
          REDIS_PORT: String(port),
          REDIS_PASSWORD: password,
        })`./gradlew bootRun`

        // `redisClient` will be automatically cleaned up at the end of the scope.
      }
   * ```
   */
  static async create(state: RedisState = {}): Promise<LocalRedisClient> {
    const iState: RedisInternalState = {
      ...state,
      password: "redis",
      port: 6379,
      host: "127.0.0.1",
      dockerName: `local-redis-${randomUUIDv7()}`,
    };

    const hostPort = await this.launch(iState);
    iState.port = hostPort;
    await this.waitUntilReady(iState);

    return new this(iState);
  }

  private static async launch(iState: RedisInternalState): Promise<number> {
    await $`docker run -d \
        --name ${iState.dockerName} \
        -p 6379 \
        mirror.gcr.io/library/redis:7-alpine \
        redis-server --requirepass ${iState.password}`;

    const raw = (
      await $`docker port ${iState.dockerName} 6379/tcp`.text()
    ).trim();
    const match = raw.match(/:(\d+)/);
    if (!match) {
      throw new Error(`Could not parse host port from: ${raw}`);
    }
    return Number(match[1]);
  }

  private static async waitUntilReady(iState: RedisInternalState) {
    console.log(`Waiting for ${iState.dockerName} to become ready.`);

    const attempts = 30;
    const ready = await Utils.waitUntil({
      attempts,
      intervalMs: 2000,
      predicate: async (attempt) => {
        const check =
          await $`docker exec ${iState.dockerName} redis-cli -a ${iState.password} ping`
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

  get state(): RedisInternalState {
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
