import { demoRecord, expect, expectNoHorizontalScroll, signIn, test } from './support'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

test('Flow F — on a phone: sign in and log a completed PACE with your thumb', async ({ page }) => {
  await signIn(page)
  await expectNoHorizontalScroll(page)

  // The center tab is the primary action.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log progress', exact: true }).tap()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  await form.getByRole('radio', { name: /^Sarah/ }).tap()
  await form.getByRole('radio', { name: /^Mathematics/ }).tap()
  await expect(form.getByLabel('PACE', { exact: true })).toHaveValue('1072')
  await form.getByLabel('Test score').fill('90')
  await form.getByRole('button', { name: 'Save', exact: true }).tap()

  const saved = page.getByRole('dialog', { name: 'Progress saved' })
  await expect(saved).toContainText('Mathematics 1072 completed · 90%')
  expect(await demoRecord('Sarah', 'Mathematics', 1072)).toMatchObject({ status: 'completed', test_score: 90 })

  await saved.getByRole('button', { name: 'Start 1073' }).tap()
  await expect(page.getByRole('button', { name: 'Sarah, Mathematics: on 1073. Log progress.' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Every other page fits the phone too.
  for (const path of ['/students', '/records', '/reports', '/settings']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
  await page.goto('/students')
  await page.getByRole('link', { name: /Sarah/ }).first().tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Sarah Carter' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})
