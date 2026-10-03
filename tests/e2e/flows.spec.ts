import { demoEvents, demoRecord, expect, signIn, test } from './support'

/*
 * Flows B–E on the seeded demo homeschool, in order: each builds on the record the
 * previous one wrote (Gabriel’s Mathematics 1084 starts out active).
 */
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('Flow B — log Gabriel’s Math 1084 at 94% and see it everywhere', async ({ page }) => {
  expect(await demoRecord('Gabriel', 'Mathematics', 1084)).toMatchObject({ status: 'active' })

  await page.getByRole('button', { name: 'Log progress', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  await form.getByRole('radio', { name: /^Gabriel/ }).click()
  await form.getByRole('radio', { name: /^Mathematics/ }).click()
  // Smart prefill: the active PACE, marked completed, cursor in the score.
  await expect(form.getByLabel('PACE', { exact: true })).toHaveValue('1084')
  await expect(form.getByRole('radio', { name: 'Completed' })).toHaveAttribute('aria-checked', 'true')
  await expect(form.getByLabel('Test score')).toBeFocused()
  await page.keyboard.type('94')
  await form.getByRole('button', { name: 'Save progress' }).click()

  const saved = page.getByRole('dialog', { name: 'Progress saved' })
  await expect(saved).toContainText('Mathematics 1084 completed · 94%')

  const record = await demoRecord('Gabriel', 'Mathematics', 1084)
  expect(record).toMatchObject({ status: 'completed', test_score: 94 })
  expect((await demoEvents(record!.id)).at(-1)).toEqual({ kind: 'completed', source: 'manual', test_score: 94 })

  // The offer to start the next PACE.
  await saved.getByRole('button', { name: 'Start 1085' }).click()
  await expect(page.getByText('Mathematics 1085 started')).toBeVisible()
  expect(await demoRecord('Gabriel', 'Mathematics', 1085)).toMatchObject({ status: 'active' })

  // Dashboard: the matrix and the activity feed.
  await expect(page.getByRole('button', { name: /^Gabriel, Mathematics — 1085 in progress/ })).toBeVisible()
  await expect(page.getByText('Gabriel completed Mathematics 1084 · 94%')).toBeVisible()
  await expect(page.getByText('Gabriel started Mathematics 1085')).toBeVisible()

  // Records and the weekly report read the same row.
  await page.goto('/records')
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1084, Completed, 94%/ })).toBeVisible()
  await page.goto('/reports/weekly')
  const completed = page.getByRole('region', { name: 'Completed PACEs' })
  await expect(completed.getByRole('row').filter({ hasText: 'Gabriel' }).filter({ hasText: '1084' })).toContainText('94%')
})

test('Flow C — from Students to Gabriel’s Math history, inspect 1084', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Students' }).click()
  await page.waitForURL('**/students')
  await page.getByRole('link', { name: /Gabriel/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gabriel Carter' })).toBeVisible()

  // The PACE strip shows the new score…
  const strip = page.getByRole('list', { name: 'Mathematics PACE progression' })
  await expect(strip.getByRole('button', { name: /^Mathematics 1084, completed .*94%/ })).toBeVisible()

  // …and the history, filtered to Mathematics, opens the record.
  await page.getByLabel('Filter history by subject').selectOption({ label: 'Mathematics' })
  await page.getByRole('link', { name: 'Mathematics 1084, Completed, 94%. Open record.' }).click()
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
})

test('Flow D — “Gabriel completed Math 1085 with 91%”, confirmed, is written', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'AI Assistant' }).click()
  await page.waitForURL('**/assistant')
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
})

test('Flow E — records filtered to Gabriel and Mathematics', async ({ page }) => {
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
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1085, Completed, 91%/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Gabriel, Mathematics 1084, Completed, 94%/ })).toBeVisible()

  // The filtered view survives a reload — it lives in the URL.
  await page.reload()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue(/.+/)
  await expect(page.locator('tbody tr')).toHaveCount(texts.length)
})
