// The seeded demo account (see scripts/seed-demo.ts). Only surfaced on the sign-in page
// when FOLIO_DEMO_LOGIN=1 outside production; it lives in a household flagged is_demo.
export const DEMO_CREDENTIALS = { email: 'demo@folio.app', password: 'folio-demo' } as const
