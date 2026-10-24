import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { latestLinkFor } from './mail'

const run = Date.now().toString(36)
const owner = {
  name: 'Dylan Owner',
  email: `owner-${run}@example.com`,
  password: 'bookworm-42',
}
const friend = {
  name: 'Jimmy Friend',
  email: `friend-${run}@example.com`,
  password: 'bookworm-43',
}

async function createAccount(page: Page, who: typeof owner) {
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByLabel('Name').fill(who.name)
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password', { exact: true }).fill(who.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(
    page.getByRole('heading', { name: 'Check your inbox' }),
  ).toBeVisible()
  await page.goto(await latestLinkFor(who.email))
}

test('sign up, create a club, invite a friend who joins while signed out', async ({
  browser,
}) => {
  const ownerPage = await (await browser.newContext()).newPage()

  await ownerPage.goto('/')
  await expect(ownerPage).toHaveURL(/\/login/)
  await createAccount(ownerPage, owner)
  await expect(
    ownerPage.getByRole('heading', { name: 'Your clubs' }),
  ).toBeVisible()
  await expect(ownerPage.getByText('No clubs yet')).toBeVisible()

  await ownerPage.getByRole('link', { name: 'Create a club' }).click()
  await ownerPage.getByLabel('Club name').fill('The Overdue Society')
  await ownerPage
    .getByLabel(/Description/)
    .fill('Friends who swear they will finish this one.')
  await ownerPage.getByRole('button', { name: 'Create club' }).click()

  await expect(
    ownerPage.getByRole('heading', { name: 'The Overdue Society is ready' }),
  ).toBeVisible()
  await expect(
    ownerPage.getByText('Works for 7 days and up to 20 people.'),
  ).toBeVisible()
  const shown = await ownerPage.getByLabel('Invite link').inputValue()
  const inviteUrl = `http://${shown}`
  expect(inviteUrl).toMatch(/\/join\/[\w-]+$/)

  await ownerPage.getByRole('link', { name: 'Done, go to club' }).click()
  await expect(
    ownerPage.getByRole('link', {
      name: /The Overdue Society, back to your clubs/,
    }),
  ).toBeVisible()

  // The friend opens the link signed out, creates an account, and comes back to the invite.
  const friendPage = await (await browser.newContext()).newPage()
  await friendPage.goto(inviteUrl)
  await expect(
    friendPage.getByRole('heading', { name: 'The Overdue Society' }),
  ).toBeVisible()
  await expect(
    friendPage.getByText('Dylan Owner invited you · 1 member'),
  ).toBeVisible()
  await friendPage
    .getByRole('button', { name: 'New here? Create an account' })
    .click()
  await createAccount(friendPage, friend)
  await expect(friendPage).toHaveURL(/\/join\//)
  await friendPage.getByRole('button', { name: 'Join club' }).click()
  await expect(friendPage.getByText('Members (2)')).toBeVisible()
  await expect(
    friendPage.getByRole('link', { name: 'Club settings' }),
  ).toHaveCount(0)

  // Opening the link again says they're already in.
  await friendPage.goto(inviteUrl)
  await expect(
    friendPage.getByRole('heading', {
      name: "You're already in The Overdue Society",
    }),
  ).toBeVisible()

  // The owner promotes the friend to admin.
  await ownerPage.reload()
  await ownerPage.getByRole('link', { name: 'Club settings' }).click()
  await expect(ownerPage.getByText('1 of 20 uses')).toBeVisible()
  await ownerPage
    .getByRole('button', { name: /Change role for Jimmy Friend/ })
    .click()
  await ownerPage.getByRole('menuitem', { name: 'Make admin' }).click()
  await expect(
    ownerPage.getByRole('button', {
      name: /Change role for Jimmy Friend, currently Admin/,
    }),
  ).toBeVisible()

  // Revoking the link stops new joins.
  await ownerPage.getByRole('button', { name: 'Revoke', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Revoke link' }).click()
  await expect(
    ownerPage.getByText('No active link. Make one to invite people.'),
  ).toBeVisible()
  const strangerPage = await (await browser.newContext()).newPage()
  await strangerPage.goto(inviteUrl)
  await expect(
    strangerPage.getByRole('heading', {
      name: 'This invite link was turned off',
    }),
  ).toBeVisible()
})

test('wrong password gets the same message as an unknown email', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`nobody-${run}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Email or password is incorrect.',
  )
})

test('signed-out visitors are sent to sign in and back', async ({ page }) => {
  await page.goto('/clubs/new')
  await expect(page).toHaveURL(/\/login\?next=%2Fclubs%2Fnew/)
})
