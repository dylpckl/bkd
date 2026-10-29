import { devices, expect, test } from '@playwright/test'
import type { Browser, Locator, Page } from '@playwright/test'

// Ranking by finger on a phone: press and hold a book, then drag it.
async function signIn(browser: Browser, email: string, phone = false) {
  const context = await browser.newContext(phone ? devices['Pixel 7'] : {})
  const page = await context.newPage()
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

/** A real touch drag: press, hold past the 150ms delay, then move in small steps and lift. */
async function touchDrag(page: Page, from: Locator, to: Locator) {
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) throw new Error('drag target not visible')
  const x = a.x + a.width / 2
  const y0 = a.y + a.height / 2
  const y1 = b.y + b.height / 4
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    })
  await touch('touchStart', y0)
  await page.waitForTimeout(300)
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', y0 + ((y1 - y0) * i) / 12)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(100)
  await touch('touchEnd', y1)
}

test('on a phone, press and drag a book to rank it, which casts the vote', async ({
  browser,
}) => {
  const owner = await signIn(browser, 'dylan@example.com')
  await owner.getByRole('link', { name: 'Create a club' }).click()
  await owner
    .getByLabel('Club name')
    .fill(`Touch Club ${Date.now().toString(36)}`)
  await owner.getByRole('button', { name: 'Create club' }).click()
  const inviteUrl = `http://${await owner.getByLabel('Invite link').inputValue()}`
  await owner.getByRole('link', { name: 'Done, go to club' }).click()
  await owner.getByRole('link', { name: 'Pick the next book' }).click()
  await owner.getByRole('button', { name: 'Start voting' }).click()
  await expect(owner.getByRole('heading', { name: 'Book 1' })).toBeVisible()
  const voteUrl = owner.url()
  await nominate(owner, 'piranesi', /Piranesi/)

  const jimmy = await signIn(browser, 'jimmy@example.com')
  await jimmy.goto(inviteUrl)
  await jimmy.getByRole('button', { name: 'Join club' }).click()
  await jimmy.waitForURL(/\/c\/[^/]+$/)
  await jimmy.goto(voteUrl)
  await nominate(jimmy, 'hail mary', /Project Hail Mary/)

  // Adam joins on a phone and nominates; his ballot has the other two books.
  const adam = await signIn(browser, 'adam@example.com', true)
  await adam.goto(inviteUrl)
  await adam.getByRole('button', { name: 'Join club' }).click()
  await adam.waitForURL(/\/c\/[^/]+$/)
  await adam.goto(voteUrl)
  await nominate(adam, 'circe', /Circe/)
  await adam.reload()

  const order = await ballotTitles(adam)
  expect([...order].sort()).toEqual(['Piranesi', 'Project Hail Mary'])
  // Press anywhere on the card, not just the handle: here, on the second book's title.
  const ballot = adam.getByRole('list', { name: 'Your ranked ballot' })
  const title = (t: string) => ballot.locator('strong', { hasText: t })
  await touchDrag(adam, title(order[1]), title(order[0]))

  await expect(adam.getByText('✓ Saved')).toBeVisible()
  expect(await ballotTitles(adam)).toEqual([order[1], order[0]])
  // Letting go after the drag doesn't count as a tap that opens the book.
  await expect(adam.getByRole('dialog')).toHaveCount(0)
  await adam.reload()
  expect(await ballotTitles(adam)).toEqual([order[1], order[0]])

  // The handle still works too: move it back.
  const handles = adam.getByRole('button', { name: /^Reorder / })
  await touchDrag(adam, handles.nth(1), handles.nth(0))
  await expect.poll(() => ballotTitles(adam)).toEqual(order)

  // A plain tap on a book still opens its details.
  await title(order[0]).tap()
  await expect(adam.getByRole('dialog')).toBeVisible()
})
