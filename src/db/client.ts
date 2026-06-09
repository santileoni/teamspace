import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getDatabaseUrl } from "@/db/database-url";

const databaseUrl = getDatabaseUrl();

const globalForDb = globalThis as unknown as {
  dbClient?: postgres.Sql;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
  globalForDb.dbClient ??
  postgres(databaseUrl, {
    idle_timeout: 5,
    max: process.env.NODE_ENV === "test" ? 1 : 10
  });

export const db =
  globalForDb.db ??
  drizzle(client, {
    schema
  });

export async function closeDb() {
  await client.end();
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client;
  globalForDb.db = db;
}
