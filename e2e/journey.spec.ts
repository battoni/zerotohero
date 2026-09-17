import { expect, test } from '@playwright/test'
import { enterDemo, go } from './helpers'

test.describe.configure({ mode: 'serial' })

test('create a trail from a pasted list, tick milestones and attach evidence', async ({ page }) => {
  await enterDemo(page)

  await go(page, '/tracks/new')
  await page.getByTestId('editor-start-paste').click()
  await page.getByTestId('editor-paste').fill([
    '# Learn Rust',
    '> Ownership without tears',
    'emoji: 🦀 | color: coral | visibility: friends',
    '## Basics',
    '- [x] Install rustup #setup @2026-09-10',
    '- The book, chapters 1–4 #study',
    '## Projects',
    '- CLI todo app #project',
  ].join('\n'))
  await page.getByTestId('editor-paste-apply').click()
  await expect(page.getByTestId('editor-title')).toHaveValue('Learn Rust')
  await page.getByTestId('editor-save').click()

  await page.waitForURL(/\/tracks\/[^/]+$/)
  await expect(page.getByTestId('track-title')).toHaveText('Learn Rust')
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '33%')

  // Toggle the second milestone on the path, then back off.
  const toggles = page.locator('[data-testid^="toggle-"]')
  await toggles.nth(1).click()
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '67%')
  await toggles.nth(1).click()
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '33%')

  // Complete the next milestone with a link.
  await page.getByTestId('track-complete-next').click()
  await page.getByTestId('evidence-url').fill('not a link')
  await page.getByTestId('complete-submit').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByTestId('evidence-url').fill('https://doc.rust-lang.org/book/')
  await page.getByTestId('evidence-learned').fill('Borrowing is a compile-time contract.')
  await page.getByTestId('complete-submit').click()
  await expect(page.getByTestId('celebrate')).toBeVisible()
  await page.getByTestId('celebrate-close').click()
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '67%')
  await expect(page.getByTestId('track-evidence')).toContainText('doc.rust-lang.org/book/')

  // Persisted in the browser across a reload.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '67%')
})

test('copy a public template and cheer a friend', async ({ page }) => {
  await enterDemo(page)

  await go(page, '/explore')
  await page.getByTestId('explore-search').fill('aws')
  await expect(page.getByTestId('explore-list')).not.toContainText('Technical English')
  const use = page.locator('[data-testid^="explore-use-"]').first()
  await expect(use).toBeVisible()
  await use.click()
  await page.waitForURL(/\/tracks\/[^/]+\/edit$/)
  await expect(page.getByTestId('editor-title')).toHaveValue('AWS Developer in 8 weeks')
  await page.getByTestId('editor-save').click()
  await page.waitForURL(/\/tracks\/[^/]+$/)
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '0%')

  await go(page, '/friends')
  const cheer = page.locator('[data-testid^="kudos-"][aria-pressed="false"]').first()
  const testId = await cheer.getAttribute('data-testid')
  await cheer.click()
  await expect(page.getByTestId(testId!)).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId(/^accept-/).first().click()
  await expect(page.getByTestId('friend-requests')).toHaveCount(0)
  await expect(page.getByTestId('friends-list')).toContainText('Bruno')
})

test('switches language and keeps the session', async ({ page }) => {
  await enterDemo(page)
  await page.getByTestId('locale-switch').click()
  await page.waitForURL('**/pt-BR/tracks')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.getByTestId('nav-tracks')).toHaveText('Minhas trilhas')
  await expect(page.getByTestId('home-greeting')).toContainText('Bora riscar')
})

test('protected pages send signed-out visitors to login', async ({ page }) => {
  await go(page, '/friends')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('login-demo')).toBeVisible()
})

test('an unknown trail shows a friendly message', async ({ page }) => {
  await enterDemo(page)
  await go(page, '/tracks/does-not-exist')
  await expect(page.getByTestId('track-not-found')).toBeVisible()
})
