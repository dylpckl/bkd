import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Automated accessibility checks (WCAG 2.1 A/AA) on the main screens, signed in
// as the seeded owner of The Overdue Society. Catches contrast, names and roles;
// keyboard and screen-reader flows are covered in the other specs.
const CLUB = '10000000-0000-4000-8000-000000000001'
const BOOK = '21000000-0000-4000-8000-000000000004'
const PAGES = [
  '/clubs',
  '/profile',
  `/c/${CLUB}`,
  `/c/${CLUB}/books`,
  `/c/${CLUB}/books/${BOOK}`,
  `/c/${CLUB}/books/${BOOK}/reviews`,
  `/c/${CLUB}/books/${BOOK}/review`,
  `/c/${CLUB}/settings`,
  `/c/${CLUB}/votes/new`,
]

test('main screens have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/login')
  const login = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(login.violations, '/login').toEqual([])

  await page.getByLabel('Email').fill('dylan@example.com')
  await page.getByLabel('Password', { exact: true }).fill('bookclub')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/clubs')

  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target.join(' ')),
      })),
      path,
    ).toEqual([])
  }
})
