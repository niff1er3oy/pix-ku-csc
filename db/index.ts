import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as relations from "./relations";
import * as schema from "./schema";

const schemaWithRelations = { ...schema, ...relations };

// `next dev` re-evaluates modules on every hot reload. Without this the pool
// would be recreated each time until Postgres refuses new connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema: schemaWithRelations });

export { schema };
export * from "./schema";
