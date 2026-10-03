import { expect, query, test } from './support'

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'Word Building', 'Literature']

test('Flow A — create an account, set up the homeschool, arrive Home', async ({ page }) => {
  const email = `e2e+${Date.now()}@example.test`

  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Rachel Carter')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-9')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('**/onboarding')

  // 1 · Homeschool
  await expect(page.getByRole('heading', { name: 'Let’s set up your homeschool.' })).toBeVisible()
  await page.getByLabel('Homeschool name').fill('Carter Family School')
  await page.getByRole('button', { name: 'Continue' }).click()

  // 2 · Students — paste a list, then keep typing; Enter adds a row.
  await expect(page.getByRole('heading', { name: 'Who’s learning at home?' })).toBeVisible()
  await page.getByLabel('Student 1 first name').evaluate((input) => {
    const data = new DataTransfer()
    data.setData('text', 'Gabriel, Sarah')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(page.getByLabel('Student 2 first name')).toHaveValue('Sarah')
  await page.getByLabel('Student 2 first name').press('Enter')
  await page.keyboard.type('Joshua')
  await page.getByRole('button', { name: 'Continue' }).click()

  // 3 · Subjects — the six A.C.E. core subjects are preselected.
  await expect(page.getByRole('heading', { name: 'Which subjects are they taking?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // 4 · Current PACEs — typed for two students, “Fill row” for the third.
  await expect(page.getByRole('heading', { name: 'Where is everyone right now?' })).toBeVisible()
  const grid: Record<string, number[]> = {
    Gabriel: [1084, 1081, 1080, 1083, 1082, 1080],
    Sarah: [1072, 1078, 1069, 1070, 1071, 1068]
  }
  for (const [name, paces] of Object.entries(grid)) {
    for (const [index, pace] of paces.entries()) {
      await page.getByLabel(`${name} — ${SUBJECTS[index]} current PACE`).filter({ visible: true }).fill(String(pace))
    }
  }
  await page.getByLabel('Joshua — Mathematics current PACE').filter({ visible: true }).fill('1094')
  await page.locator('tr', { hasText: 'Joshua' }).getByRole('button', { name: 'Fill row' }).click()
  await expect(page.getByLabel('Joshua — Literature current PACE').filter({ visible: true })).toHaveValue('1094')
  await page.getByRole('button', { name: 'Finish setup' }).click()

  // 5 · Confirmation
  await expect(page.getByRole('heading', { name: 'Carter Family School is ready.' })).toBeVisible()
  await expect(page.getByText('3 students and 18 current PACEs are set up.')).toBeVisible()
  await page.getByRole('button', { name: 'Go to Home' }).click()

  await page.waitForURL('**/home')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rachel')
  await expect(page.getByRole('button', { name: 'Gabriel, Mathematics: on 1084. Log progress.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Joshua, Literature: on 1094. Log progress.' })).toBeVisible()

  const [household] = await query<{ name: string; is_demo: boolean; students: string; active: string }>(
    `select h.name, h.is_demo,
            (select count(*) from students s where s.household_id = h.id) as students,
            (select count(*) from pace_records p where p.household_id = h.id and p.status = 'active') as active
       from households h
       join household_members m on m.household_id = h.id
       join users u on u.id = m.user_id
      where u.email = $1`,
    [email]
  )
  expect(household).toEqual({ name: 'Carter Family School', is_demo: false, students: '3', active: '18' })
})
