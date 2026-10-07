import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function sqliteFilename(databaseUrl: string): string {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    return ":memory:";
  }
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.slice("file:".length);
  }
  return databaseUrl;
}

export function createDatabase(databaseUrl: string): AppDatabase {
  const filename = sqliteFilename(databaseUrl);
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder });
  return database;
}
