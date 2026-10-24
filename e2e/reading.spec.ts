import { expect, test } from '@playwright/test'
import type { Browser } from '@playwright/test'

// Seeded accounts (password "bookclub"). Each run makes its own club and book
// through the UI: start a vote, nominate, close early.
async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('bookclub')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/clubs')
  return page
}

test('discuss, then reviews stay hidden until you post yours, and the book finishes when everyone has', async ({
  browser,
}) => {
  const owner = await signIn(browser, 'dylan@example.com')
  await owner.getByRole('link', { name: 'Create a club' }).click()
  await owner
    .getByLabel('Club name')
    .fill(`Read Club ${Date.now().toString(36)}`)
  await owner.getByRole('button', { name: 'Create club' }).click()
  const inviteUrl = `http://${await owner.getByLabel('Invite link').inputValue()}`
  await owner.getByRole('link', { name: 'Done, go to club' }).click()

  const friend = await signIn(browser, 'priya@example.com')
  await friend.goto(inviteUrl)
  await friend.getByRole('button', { name: 'Join club' }).click()
  await friend.waitForURL(/\/c\/[^/]+$/)
  const clubUrl = friend.url()

  // One nomination, closed early: it wins automatically.
  await owner.reload()
  await owner.getByRole('link', { name: 'Pick the next book' }).click()
  await owner.getByRole('button', { name: 'Start voting' }).click()
  await owner.getByRole('button', { name: 'Nominate a book' }).click()
  await owner.getByRole('combobox', { name: 'Search books' }).fill('piranesi')
  await owner.getByRole('option', { name: /Piranesi/ }).click()
  await owner.getByRole('button', { name: 'Nominate this book' }).click()
  await owner.getByRole('link', { name: 'Manage voting' }).click()
  await owner.getByRole('button', { name: /Close voting now/ }).click()
  await owner.getByRole('button', { name: 'Close & count' }).click()
  await owner.getByRole('link', { name: 'Go to Piranesi' }).click()

  // Discussion with a reply.
  await owner
    .getByLabel('Write a post')
    .fill('Anyone else sketching the House?')
  await owner.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(
    owner.getByText('Anyone else sketching the House?'),
  ).toBeVisible()

  await friend.goto(clubUrl)
  await expect(friend.getByText('0 of 2 finished')).toBeVisible()
  await friend.getByRole('link', { name: 'Discussion', exact: true }).click()
  await friend.getByRole('button', { name: 'Reply' }).click()
  await friend.getByLabel(/Reply to Dylan/).fill('Yes, on my bookmark.')
  await friend.getByRole('button', { name: 'Post reply' }).click()
  await expect(friend.getByText('1 reply')).toBeVisible()

  // The owner reviews first, with a half star from the keyboard.
  await owner.reload()
  await owner.getByRole('link', { name: 'Reviews' }).click()
  await owner
    .getByRole('link', { name: 'Finished it? Post your review' })
    .click()
  await owner.getByRole('radio', { name: '4 stars' }).click()
  await owner.keyboard.press('ArrowRight')
  await expect(owner.getByText('4.5 stars', { exact: true })).toBeVisible()
  await expect(owner.getByText('so this becomes 5 stars there')).toBeVisible()
  await owner.getByLabel(/^Review/).fill('Quiet, strange and kind.')
  await owner.getByRole('button', { name: 'Finish & post review' }).click()
  await expect(
    owner.getByText('You finished Piranesi · 4.5 stars'),
  ).toBeVisible()

  // Priya hasn't finished: progress only. No average, breakdown or review text.
  await friend.getByRole('link', { name: 'Reviews' }).click()
  await expect(
    friend.getByRole('heading', { name: 'Finish the book to see the reviews' }),
  ).toBeVisible()
  await expect(friend.getByText('4.5', { exact: true })).toHaveCount(0)
  await expect(friend.getByText('Quiet, strange and kind.')).toHaveCount(0)

  // Once she posts, both reviews show and the book is finished.
  await friend
    .getByRole('link', { name: 'Finished it? Post your review' })
    .click()
  await friend.getByRole('radio', { name: '3 stars' }).click()
  await friend.getByRole('button', { name: 'Finish & post review' }).click()
  await friend.getByRole('link', { name: 'See club reviews' }).click()
  await expect(friend.getByText('Quiet, strange and kind.')).toBeVisible()
  await expect(friend.getByText('Finished · Book 1')).toBeVisible()
  await expect(friend.getByText('3.8', { exact: true })).toBeVisible()
})
