import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
/** Anything that can run a query: the pool-backed database or an open transaction. */
export type DbExecutor = Database | Transaction

// Kept free of `server-only` so scripts (migrations, seeding) and tests can open
// their own connection. Application code imports the shared instance from ./index.
export function createDatabase(connectionString: string): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString, max: 10 })
  return { db: drizzle(pool, { schema }), pool }
}
