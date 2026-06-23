export interface PostgresState {
  database: string;
}

export interface PostgresInternalState extends PostgresState {
  port: number;
  host: string;
  user: string;
  password: string;
  dockerName: string;
}
