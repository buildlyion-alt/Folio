import { execFileSync } from 'node:child_process'
import { E2E_DATABASE_URL } from './env'

/** Brings the test database up to date and rebuilds the demo homeschool, dated to today. */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL }
  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], { env, stdio: 'inherit' })
  execFileSync('npx', ['tsx', 'scripts/seed-demo.ts'], { env, stdio: 'inherit' })
}
