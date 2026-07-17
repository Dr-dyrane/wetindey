import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create a connection pool targeting our Neon database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for serverless database SSL connections
  }
});

export const db = drizzle(pool, { schema });
/* Not exported: no file imports DbClient. The `db` instance is the public surface. */
type _DbClient = typeof db;
export * from "./schema";
