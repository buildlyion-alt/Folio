import { loadEnvConfig } from '@next/env'

// Scripts load env files exactly the way `next dev` does (.env.local, .env, …).
// Variables already set in the shell always win, which is how tests point at folio_test.
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error })

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.')
  return url
}
