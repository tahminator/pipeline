export interface PostgresState {
  database: string;
  /**
   * Postgres image version, either a major (`18`) or a major.minor (`"18.1"`).
   * Must be 16 or newer. Defaults to 16.
   */
  version?: number | string;
}

export interface PostgresInternalState extends PostgresState {
  version: string;
  port: number;
  host: string;
  user: string;
  password: string;
  dockerName: string;
}
