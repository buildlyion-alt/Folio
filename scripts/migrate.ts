import { requireDatabaseUrl } from './env'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDatabase } from '../src/server/db/client'

async function main(): Promise<void> {
  const { db, pool } = createDatabase(requireDatabaseUrl())
  await migrate(db, { migrationsFolder: './drizzle' })
  await pool.end()
  console.log('Migrations applied.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
