import { demoEvents, demoRecord, expect, signIn, test } from './support'

/*
 * Flows B–E on the seeded demo homeschool (six children), in order: each builds on the
 * record the previous one wrote (Gabriel’s Mathematics 1084 starts out in progress).
 */
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('Flow B — record “Gabriel, Math 1084, 94%” from Home in seconds, and see it everywhere', async ({ page }) => {
  expect(await demoRecord('Gabriel', 'Mathematics', 1084)).toMatchObject({ status: 'active' })

  // Home answers “what is everyone working on”; Gabriel’s Mathematics cell is the shortcut.
  const started = Date.now()
  await page.getByRole('button', { name: 'Gabriel, Mathematics: on 1084. Log progress.' }).click()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  // Smart prefill: the child, the subject, the PACE in progress, marked completed, cursor in the score.
  await expect(form.getByRole('radio', { name: /^Gabriel/ })).toHaveAttribute('aria-checked', 'true')
  await expect(form.getByRole('radio', { name: /^Mathematics/ })).toHaveAttribute('aria-checked', 'true')
  await expect(form.getByLabel('PACE', { exact: true })).toHaveValue('1084')
  await expect(form.getByRole('radio', { name: 'Completed' })).toHaveAttribute('aria-checked', 'true')
  await expect(form.getByLabel('Test score')).toBeFocused()
  await page.keyboard.type('94')
  await page.keyboard.press('Enter')

  const saved = page.getByRole('dialog', { name: 'Progress saved' })
  await expect(saved).toContainText('Mathematics 1084 completed · 94%')
  expect(Date.now() - started, 'one click, two keys, saved').toBeLessThan(10_000)

  const record = await demoRecord('Gabriel', 'Mathematics', 1084)
  expect(record).toMatchObject({ status: 'completed', test_score: 94 })
  expect((await demoEvents(record!.id)).at(-1)).toEqual({ kind: 'completed', source: 'manual', test_score: 94 })

  // The offer to start the next PACE.
  await saved.getByRole('button', { name: 'Start 1085' }).click()
  await expect(page.getByText('Mathematics 1085 started')).toBeVisible()
  expect(await demoRecord('Gabriel', 'Mathematics', 1085)).toMatchObject({ status: 'active' })
  await expect(page.getByRole('button', { name: 'Gabriel, Mathematics: on 1085. Log progress.' })).toBeVisible()

  // Records and the weekly report read the same row.
  await page.goto('/records')
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1084, 94%/ })).toBeVisible()
  await page.goto('/reports/weekly')
  const completed = page.getByRole('region', { name: 'Completed PACEs' })
  await expect(completed.getByRole('row').filter({ hasText: 'Gabriel' }).filter({ hasText: '1084' })).toContainText('94%')
})

test('Flow C — from Students to Gabriel’s Math results, inspect 1084', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Students' }).click()
  await page.waitForURL('**/students')
  await page.getByRole('link', { name: /Gabriel/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gabriel Carter' })).toBeVisible()

  // Each subject: current PACE and last score at a glance; its results one click away.
  const math = page.getByRole('button', { name: /^Mathematics\s*, current PACE\s*1085\s*, last score\s*94%/ })
  await expect(math).toHaveAttribute('aria-expanded', 'false')
  await math.click()
  await expect(math).toHaveAttribute('aria-expanded', 'true')
  const results = page.locator('#' + (await math.getAttribute('aria-controls')))
  await expect(results.getByRole('link', { name: /^Mathematics 1085, In progress/ })).toBeVisible()
  await results.getByRole('link', { name: /^Mathematics 1084, 94%/ }).click()

  const detail = page.getByRole('dialog', { name: 'Mathematics 1084' })
  await expect(detail).toContainText('Gabriel')
  await expect(detail).toContainText('94%')
  await expect(detail.getByRole('listitem').filter({ hasText: 'Completed · 94%' })).toContainText('Logged')

  // Safeguards: editing shows the saved values; deleting asks first, and cancel keeps the record.
  await detail.getByRole('button', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Mathematics 1084' })
  await expect(edit.getByLabel('Test score')).toHaveValue('94')
  await edit.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('dialog', { name: 'Mathematics 1084' }).getByRole('button', { name: 'Delete record' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete this record?' })
  await expect(confirm).toContainText('Mathematics 1084 will be removed')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  expect(await demoRecord('Gabriel', 'Mathematics', 1084)).toMatchObject({ status: 'completed', test_score: 94 })

  // On a child’s page the one primary action — Log progress — already knows who.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Log progress', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  await expect(form.getByRole('radio', { name: /^Gabriel/ })).toHaveAttribute('aria-checked', 'true')
  await form.getByRole('button', { name: 'Cancel' }).click()
})

test('Flow D — “Gabriel completed Math 1085 with 91%”, typed on Home, confirmed, is written', async ({ page }) => {
  // AI is a shortcut on Home, not a destination.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Home', 'Students', 'Records', 'Reports'])
  await page.getByLabel('Tell Folio what happened, or ask a question').fill('Gabriel completed Math 1085 with 91%')
  await page.getByRole('button', { name: 'Interpret' }).click()

  await expect(page.getByText('1 update detected')).toBeVisible()
  await expect(page.getByText('Nothing is saved until you confirm.', { exact: true })).toBeVisible()
  const change = page.getByRole('list', { name: 'Proposed updates' }).getByRole('listitem')
  await expect(change).toHaveCount(1)
  await expect(change).toContainText('Gabriel')
  await expect(change).toContainText('Mathematics')
  await expect(change).toContainText('1085')
  await expect(change).toContainText('91%')
  // Interpreting wrote nothing.
  expect(await demoRecord('Gabriel', 'Mathematics', 1085)).toMatchObject({ status: 'active', test_score: null })

  await page.getByRole('button', { name: 'Confirm update' }).click()
  await expect(page.getByText('1 update saved').first()).toBeVisible()

  const record = await demoRecord('Gabriel', 'Mathematics', 1085)
  expect(record).toMatchObject({ status: 'completed', test_score: 91 })
  expect((await demoEvents(record!.id)).at(-1)).toEqual({ kind: 'completed', source: 'assistant', test_score: 91 })

  // The same shortcut lives inside Log progress.
  await page.getByRole('button', { name: 'Log progress', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  await form.getByRole('button', { name: 'Type it instead' }).click()
  await expect(form.getByLabel('Tell Folio what happened, or ask a question')).toBeFocused()
  await form.getByRole('button', { name: 'Use the form instead' }).click()
  await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
})

test('Flow E — Records: Gabriel’s Mathematics, then last month', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Records' }).click()
  await page.waitForURL('**/records')
  await page.getByLabel('Student', { exact: true }).selectOption({ label: 'Gabriel Carter' })
  await page.waitForURL(/student=/)
  await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' })
  await page.waitForURL(/subject=/)

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const texts = await rows.allInnerTexts()
  expect(texts.length).toBeGreaterThan(2)
  for (const text of texts) {
    expect(text).toContain('Gabriel')
    expect(text).toContain('Mathematics')
  }
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1085, 91%/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1084, 94%/ })).toBeVisible()

  // “Last month” is one choice away, and every row it keeps is dated last month.
  await page.getByLabel('When', { exact: true }).selectOption({ label: 'Last month' })
  await page.waitForURL(/from=.*to=/)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
  const [y, m] = today.split('-').map(Number)
  const lastMonth = new Date(Date.UTC(m === 1 ? y - 1 : y, (m + 10) % 12, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const monthRows = page.locator('tbody tr')
  await expect(monthRows.first()).toBeVisible()
  for (const text of await monthRows.allInnerTexts()) expect(text).toContain(lastMonth)

  // The filtered view survives a reload — it lives in the URL.
  const count = await monthRows.count()
  await page.reload()
  await expect(page.getByLabel('When', { exact: true })).toHaveValue('last_month')
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue(/.+/)
  await expect(page.locator('tbody tr')).toHaveCount(count)
})
