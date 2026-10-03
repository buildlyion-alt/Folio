export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100)
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://folio:folio@127.0.0.1:5432/folio_test'
export const DEMO = { email: 'demo@folio.app', password: 'folio-demo' }
