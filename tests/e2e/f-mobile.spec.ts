import { demoRecord, expect, expectNoHorizontalScroll, signIn, test } from './support'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

test('Flow F — on a phone: sign in and log a completed PACE', async ({ page }) => {
  await signIn(page)
  await expectNoHorizontalScroll(page)

  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log progress', exact: true }).tap()
  const form = page.getByRole('dialog', { name: 'Log progress' })
  await form.getByRole('radio', { name: /^Sarah/ }).tap()
  await form.getByRole('radio', { name: /^Mathematics/ }).tap()
  await expect(form.getByLabel('PACE', { exact: true })).toHaveValue('1072')
  await form.getByLabel('Test score').fill('90')
  await form.getByRole('button', { name: 'Save progress' }).tap()

  await expect(page.getByRole('dialog', { name: 'Progress saved' })).toContainText('Mathematics 1072 completed · 90%')
  expect(await demoRecord('Sarah', 'Mathematics', 1072)).toMatchObject({ status: 'completed', test_score: 90 })

  await page.getByRole('dialog', { name: 'Progress saved' }).getByRole('button', { name: 'Done' }).tap()
  await expect(page.getByText('Sarah completed Mathematics 1072 · 90%')).toBeVisible()
  await expectNoHorizontalScroll(page)
})
