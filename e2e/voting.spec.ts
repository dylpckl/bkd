import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

// Seeded accounts (password "bookclub") and the fixture books from search-books.
async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('bookclub')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/clubs')
  return page
}

async function nominate(page: Page, query: string, title: RegExp) {
  await page.getByRole('button', { name: 'Nominate a book' }).click()
  await page.getByRole('combobox', { name: 'Search books' }).fill(query)
  await page.getByRole('option', { name: title }).click()
  await page.getByRole('button', { name: 'Nominate this book' }).click()
  await expect(page.getByText('Your nomination').first()).toBeVisible()
}

const ballotTitles = (page: Page) =>
  page
    .getByRole('list', { name: 'Your ranked ballot' })
    .locator('strong')
    .allTextContents()

test('members rank by keyboard, the ballot autosaves, and closing early shows the results', async ({
  browser,
}) => {
  const clubName = `Vote Club ${Date.now().toString(36)}`

  // Owner creates a club and starts a vote.
  const owner = await signIn(browser, 'dylan@example.com')
  await owner.getByRole('link', { name: 'Create a club' }).click()
  await owner.getByLabel('Club name').fill(clubName)
  await owner.getByRole('button', { name: 'Create club' }).click()
  const inviteUrl = `http://${await owner.getByLabel('Invite link').inputValue()}`
  await owner.getByRole('link', { name: 'Done, go to club' }).click()
  await owner.getByRole('link', { name: 'Pick the next book' }).click()
  await owner.getByRole('button', { name: 'Start voting' }).click()
  await expect(owner.getByRole('heading', { name: 'Book 1' })).toBeVisible()
  const voteUrl = owner.url()
  await nominate(owner, 'piranesi', /Piranesi/)

  // Two friends join and nominate.
  const jimmy = await signIn(browser, 'jimmy@example.com')
  await jimmy.goto(inviteUrl)
  await jimmy.getByRole('button', { name: 'Join club' }).click()
  await jimmy.waitForURL(/\/c\/[^/]+$/)
  await jimmy.goto(voteUrl)
  await nominate(jimmy, 'hail mary', /Project Hail Mary/)

  const adam = await signIn(browser, 'adam@example.com')
  await adam.goto(inviteUrl)
  await adam.getByRole('button', { name: 'Join club' }).click()
  await adam.waitForURL(/\/c\/[^/]+$/)
  await adam.goto(voteUrl)
  await nominate(adam, 'circe', /Circe/)

  // Adam's ballot has everyone else's books, in nomination order, not yet a vote.
  await adam.reload()
  expect(await ballotTitles(adam)).toEqual(['Piranesi', 'Project Hail Mary'])
  await expect(adam.getByText('Your first move casts your vote.')).toBeVisible()
  await expect(adam.getByText('✓ Saved')).toHaveCount(0)

  // Move Hail Mary to the top with the keyboard.
  await adam.getByRole('button', { name: /Reorder Project Hail Mary/ }).focus()
  await adam.keyboard.press('Space')
  await adam.keyboard.press('ArrowUp')
  await adam.keyboard.press('Space')
  await expect(adam.getByText('✓ Saved')).toBeVisible()
  await adam.reload()
  expect(await ballotTitles(adam)).toEqual(['Project Hail Mary', 'Piranesi'])

  // Jimmy votes Piranesi first; the owner votes Hail Mary first by keeping a drop in place.
  await jimmy.reload()
  await jimmy.getByRole('button', { name: /Reorder Piranesi/ }).focus()
  await jimmy.keyboard.press('Space')
  await jimmy.keyboard.press('ArrowDown')
  await jimmy.keyboard.press('ArrowUp')
  await jimmy.keyboard.press('Space')
  await expect(jimmy.getByText('✓ Saved')).toBeVisible()

  // The owner sees who has voted and closes early.
  await owner.reload()
  await owner.getByRole('link', { name: 'Manage voting' }).click()
  await expect(owner.getByText('2 of 3')).toBeVisible()
  await owner.getByRole('button', { name: /Close voting now/ }).click()
  await owner.getByRole('button', { name: 'Close & count' }).click()
  await expect(
    owner.getByRole('heading', { name: 'How book 1 was picked' }),
  ).toBeVisible()
  await expect(owner.getByText('Winner', { exact: true })).toBeVisible()
  await expect(owner.getByText('2 ballots')).toBeVisible()

  // Club home now shows the winner as the current book.
  await owner.getByRole('link', { name: 'Back to club' }).last().click()
  await expect(owner.getByText('Currently reading')).toBeVisible()
  await expect(
    owner.getByRole('link', { name: 'How book 1 was picked' }),
  ).toBeVisible()
})
