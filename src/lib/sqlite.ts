import { DatabaseSync } from "node:sqlite";

// Loose typing over node:sqlite so row casts stay readable.
export interface Stmt {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
}
export interface Db {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  close(): void;
}

export function openDb(path: string, readOnly: boolean): Db {
  return new DatabaseSync(path, { readOnly }) as unknown as Db;
}
