import { expect, test } from '@playwright/test'
import type { Browser } from '@playwright/test'

// Uses the seeded Overdue Society history from supabase/seed.sql.
async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('bookclub')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/clubs')
  return page
}

// A 4×4 red PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4YGAARwzEcQDdQxIBgHWiQQAAAABJRU5ErkJggg==',
  'base64',
)

test('needs you, books read, all books and profile', async ({ browser }) => {
  const page = await signIn(browser, 'dylan@example.com')

  // Needs you: Dylan hasn't reviewed the book the club is reading.
  await expect(page.getByRole('heading', { name: 'Needs you' })).toBeVisible()
  // Other specs leave clubs reading Piranesi too, so pick the seeded one.
  const todo = page
    .getByRole('link', { name: /Finished Piranesi\? Post your review/ })
    .filter({ hasText: 'The Overdue Society' })
  await expect(todo).toContainText('The Overdue Society · 2 of 6 finished')

  // Club home: the carousel of finished books.
  await page
    .getByRole('link', { name: /The Overdue Society/ })
    .filter({ hasText: 'members' })
    .click()
  const carousel = page.getByRole('region', { name: 'Books we’ve read' })
  await expect(carousel.getByRole('link')).toHaveCount(4) // 3 books + See all
  await expect(carousel.getByRole('link', { name: /Circe/ })).toBeVisible()
  await carousel.getByRole('link', { name: 'See all 3' }).click()

  // All books: stats and every book, newest first, linking to its reviews.
  await expect(page.getByRole('heading', { name: 'All books' })).toBeVisible()
  const booksRead = page.locator('dl > div').first()
  await expect(booksRead).toContainText('books read')
  await expect(booksRead.locator('dd')).toHaveText('3')
  const rows = page.getByRole('main').getByRole('listitem')
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).toContainText('Piranesi')
  await expect(rows.first()).toContainText('– now · reading')
  await rows.filter({ hasText: 'Hyperion' }).click()
  await expect(page).toHaveURL(/\/reviews$/)
  await expect(page.getByText("The Priest's Tale!")).toBeVisible()

  // Profile: stats and a photo.
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Dylan' })).toBeVisible()
  // Other specs post reviews as Dylan too, so only check the shape.
  await expect(
    page.locator('dl > div').filter({ hasText: 'your avg' }).locator('dd'),
  ).toHaveText(/^★ \d(\.\d)?$/)
  await page.locator('input[type=file]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  const photo = page.getByRole('button', { name: 'Change profile photo' })
  await expect(photo.locator('img')).toHaveAttribute('src', /\/avatars\//)
  await photo.click()
  await page.getByRole('menuitem', { name: 'Remove photo' }).click()
  await expect(
    page.getByRole('button', { name: 'Add a profile photo' }),
  ).toBeVisible()
})
