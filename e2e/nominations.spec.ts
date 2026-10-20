import { expect, test } from '@playwright/test'
import type { Browser } from '@playwright/test'

// Uses the seeded accounts from supabase/seed.sql (password "bookclub") and the
// fixture books that search-books serves when no Google key is set.
async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('bookclub')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/clubs')
  return page
}

test('admin starts an anonymous vote; a member nominates, then changes their pick', async ({
  browser,
}) => {
  const clubName = `Spec Club ${Date.now().toString(36)}`

  const admin = await signIn(browser, 'dylan@example.com')
  await admin.getByRole('link', { name: 'Create a club' }).click()
  await admin.getByLabel('Club name').fill(clubName)
  await admin.getByRole('button', { name: 'Create club' }).click()
  const inviteUrl = `http://${await admin.getByLabel('Invite link').inputValue()}`
  await admin.getByRole('link', { name: 'Done, go to club' }).click()

  await admin.getByRole('link', { name: 'Pick the next book' }).click()
  await admin.getByRole('switch', { name: 'Anonymous voting' }).click()
  await admin.getByRole('button', { name: 'Start voting' }).click()
  await expect(admin.getByRole('heading', { name: 'Book 1' })).toBeVisible()
  await expect(
    admin.getByText('No books yet. Be the first to nominate one.'),
  ).toBeVisible()

  const member = await signIn(browser, 'jimmy@example.com')
  await member.goto(inviteUrl)
  await member.getByRole('button', { name: 'Join club' }).click()
  await expect(member.getByText('Voting open')).toBeVisible()
  await member.getByRole('link', { name: 'Nominate', exact: true }).click()

  await member.getByRole('combobox', { name: 'Search books' }).fill('hail mary')
  await member.getByRole('option', { name: /Project Hail Mary/ }).click()
  await expect(member.getByText('~12 hr')).toBeVisible()
  await member.getByLabel(/Why this one/).fill('Science, but make it fun.')
  await member.getByRole('button', { name: 'Nominate this book' }).click()
  await expect(
    member.getByRole('button', {
      name: 'Change your nomination, Project Hail Mary',
    }),
  ).toBeVisible()

  await member
    .getByRole('button', { name: 'Change your nomination, Project Hail Mary' })
    .click()
  await member.getByRole('combobox', { name: 'Search books' }).fill('piranesi')
  await member.getByRole('option', { name: /Piranesi/ }).click()
  await member.getByRole('button', { name: 'Nominate this instead' }).click()
  await expect(
    member.getByRole('button', { name: 'Change your nomination, Piranesi' }),
  ).toBeVisible()
  await expect(member.getByText('Nominate another')).toHaveCount(0)

  // The admin sees the book but not who nominated it.
  await admin.reload()
  await expect(admin.getByRole('button', { name: /Piranesi/ })).toBeVisible()
  await expect(admin.getByRole('img', { name: 'Jimmy' })).toHaveCount(0)
  await admin.getByRole('button', { name: /Piranesi/ }).click()
  await expect(admin.getByText('Nominated anonymously')).toBeVisible()
  await expect(admin.getByText('“Science, but make it fun.”')).toHaveCount(0)
  await admin.keyboard.press('Escape')

  await admin.getByRole('button', { name: 'Nominate a book' }).click()
  await admin.getByRole('combobox', { name: 'Search books' }).fill('piranesi')
  await expect(admin.getByRole('option', { name: /Piranesi/ })).toContainText(
    'Already nominated',
  )
  await expect(
    admin.getByRole('option', { name: /Piranesi/ }),
  ).not.toContainText('Jimmy')
})
