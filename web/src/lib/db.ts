import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH =
  process.env.DB_PATH ?? path.resolve(process.cwd(), "..", "data", "fantasynfl.db");

const globalForDb = globalThis as unknown as { db: Database.Database | undefined };

function connect(): Database.Database {
  if (globalForDb.db) return globalForDb.db;
  const instance = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.db = instance;
  }
  return instance;
}

// Lazily open the database on first use (inside a request/render) rather than at
// module load. This lets the app-level error boundary catch a missing/corrupt DB
// and render a friendly message instead of a hard module-evaluation failure.
export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop, receiver) {
    const instance = connect();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
