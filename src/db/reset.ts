import "dotenv/config";
import postgres from "postgres";
import { getDatabaseUrl } from "./database-url";

const databaseUrl = getDatabaseUrl();

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`CREATE SCHEMA public`;
}

main()
  .then(async () => {
    await sql.end();
  })
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
