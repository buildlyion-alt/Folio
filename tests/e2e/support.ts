import { expect, test as base, type Page } from '@playwright/test'
import { Client } from 'pg'
import { DEMO, E2E_DATABASE_URL } from './env'

/** Every flow also fails on uncaught page errors or console errors. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(String(error)))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await use(errors)
      expect(errors, 'page errors').toEqual([])
    },
    { auto: true }
  ]
})

export { expect }

export async function signIn(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/home')
}

/** Reads the database directly, to prove what the UI claims was saved. */
export async function query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  try {
    return (await client.query(sql, params)).rows as T[]
  } finally {
    await client.end()
  }
}

/** The demo household's record for one student, subject and PACE, or undefined. */
export async function demoRecord(firstName: string, subject: string, pace: number) {
  const rows = await query<{ id: string; status: string; test_score: number | null; completed_on: string | null }>(
    `select pr.id, pr.status, pr.test_score, to_char(pr.completed_on, 'YYYY-MM-DD') as completed_on
       from pace_records pr
       join student_subjects ss on ss.id = pr.student_subject_id
       join students st on st.id = ss.student_id
       join subjects su on su.id = ss.subject_id
       join households h on h.id = pr.household_id
      where h.is_demo and st.first_name = $1 and su.name = $2 and pr.pace_number = $3`,
    [firstName, subject, pace]
  )
  return rows[0]
}

export async function demoEvents(recordId: string) {
  return query<{ kind: string; source: string; test_score: number | null }>(
    `select kind, source, test_score from progress_events where pace_record_id = $1 order by created_at`,
    [recordId]
  )
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}
