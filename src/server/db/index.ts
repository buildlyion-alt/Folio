import 'server-only'
import { createDatabase, type Database } from './client'

// One pool per server process. In development, hot reloads re-evaluate this module,
// so the instance is parked on globalThis instead of opening a new pool each time.
const globalForDb = globalThis as unknown as { folioDb?: Database }

function connect(): Database {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and configure it.')
  }
  return createDatabase(url).db
}

export function getDb(): Database {
  if (!globalForDb.folioDb) globalForDb.folioDb = connect()
  return globalForDb.folioDb
}

export type { Database, DbExecutor, Transaction } from './client'
