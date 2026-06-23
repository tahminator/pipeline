export interface RedisState {}

export interface RedisInternalState extends RedisState {
  port: number;
  host: string;
  password: string;
  dockerName: string;
}
