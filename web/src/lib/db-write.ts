import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH =
  process.env.DB_PATH ?? path.resolve(process.cwd(), "..", "data", "fantasynfl.db");

const globalForDbWrite = globalThis as unknown as { dbWrite: Database.Database | undefined };

function connectWrite(): Database.Database {
  if (globalForDbWrite.dbWrite) return globalForDbWrite.dbWrite;
  const instance = new Database(DB_PATH, { fileMustExist: true });
  instance.pragma("journal_mode = WAL");
  instance.pragma("busy_timeout = 5000");
  instance.pragma("foreign_keys = ON");
  if (process.env.NODE_ENV !== "production") {
    globalForDbWrite.dbWrite = instance;
  }
  return instance;
}

// Writable connection for the prediction game (the only web->DB write path).
// WAL lets these writes coexist with the readonly SSR connection (db.ts) and
// the pipeline's Monday ingest. Server-only: never import from a client component.
export const dbWrite: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop, receiver) {
    const instance = connectWrite();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
