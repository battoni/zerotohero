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

  // Reopening a milestone that has evidence asks first.
  const done = page.locator('[data-testid^="toggle-"][aria-pressed="true"]').nth(1)
  await done.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('confirm-yes')).toBeVisible()
  await dialog.getByTestId('confirm-no').click()
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '67%')

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
  await page.waitForURL(/\/tracks\/new\?from=/)
  await expect(page.getByTestId('editor-title')).toHaveValue('AWS Developer in 8 weeks')
  // Cancelling creates nothing.
  await page.getByTestId('editor-cancel').click()
  await page.waitForURL('**/tracks')
  await expect(page.locator('[data-testid^="track-card-"]')).toHaveCount(2)

  await go(page, '/explore')
  await page.getByTestId('explore-search').fill('aws')
  await expect(page.getByTestId('explore-list')).not.toContainText('Technical English')
  await page.locator('[data-testid^="explore-use-"]').first().click()
  await expect(page.getByTestId('editor-title')).toHaveValue('AWS Developer in 8 weeks')
  await page.getByTestId('editor-title').fill('My AWS plan')
  await page.getByTestId('editor-save').click()
  await page.waitForURL(/\/tracks\/[^/]+$/)
  await expect(page.getByTestId('track-title')).toHaveText('My AWS plan')
  await expect(page.getByTestId('track-progress')).toHaveAttribute('aria-label', '0%')

  await go(page, '/explore')
  await page.getByTestId('explore-search').fill('aws')
  await expect(page.getByTestId('explore-list')).toContainText('used by 13 people')

  await go(page, '/friends')
  const cheer = page.locator('[data-testid^="kudos-"][data-on="false"]').first()
  const testId = await cheer.getAttribute('data-testid')
  await cheer.click()
  await expect(page.getByTestId(testId!)).toHaveAttribute('data-on', 'true')

  const items = page.getByTestId('feed').locator(':scope > [data-testid^="feed-"]:not([data-testid="feed-more"])')
  await expect(items).toHaveCount(15)
  await page.getByTestId('feed-more').click()
  await expect(items).toHaveCount(30)

  await page.getByTestId(/^accept-/).first().click()
  await expect(page.getByTestId('friend-requests')).toHaveCount(0)
  await expect(page.getByTestId('friends-list')).toContainText('Bruno')
})

test('an unsaved edit survives switching language', async ({ page }) => {
  await enterDemo(page)
  await go(page, '/tracks/new')
  await page.getByTestId('editor-title').fill('Draft in progress')
  await page.getByTestId('locale-switch').click()
  await page.waitForURL('**/pt-BR/tracks/new')
  await expect(page.getByTestId('editor-title')).toHaveValue('Draft in progress')
})

test('very long unbroken text does not overflow the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterDemo(page)
  await go(page, '/tracks/new')
  await page.getByTestId('editor-title').fill('x'.repeat(80))
  await page.getByTestId('editor-milestone-title-0-0').fill(`https://example.com/${'a'.repeat(110)}`)
  await page.getByTestId('editor-save').click()
  await page.waitForURL(/\/tracks\/[^/]+$/)
  await page.getByTestId('trail').waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
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

test('an unknown page shows a localized 404 with a way back', async ({ page }) => {
  await enterDemo(page)
  await go(page, '/pt-BR/nada-aqui')
  await expect(page.getByTestId('error-page')).toContainText('Esta página não existe')
  await page.getByTestId('error-back').click()
  await expect(page).toHaveURL(/\/pt-BR\/tracks$/)
})

test('saving a pasted list works without applying it first', async ({ page }) => {
  await enterDemo(page)
  await go(page, '/tracks/new')
  await page.getByTestId('editor-start-paste').click()
  // The format hint has literal pipes (not plural separators).
  await expect(page.locator('#editor-paste-hint')).toContainText('emoji: 🦀 | color: coral | visibility: public')
  await page.getByTestId('editor-paste').fill('# Quick list\n## Only phase\n- one\n- two')
  await page.getByTestId('editor-save').click()
  await page.waitForURL(/\/tracks\/[^/]+$/)
  await expect(page.getByTestId('track-title')).toHaveText('Quick list')
})

test('a sent friend request can be cancelled', async ({ page }) => {
  await enterDemo(page)
  await go(page, '/friends')
  await page.getByTestId('friends-search').fill('carla')
  await page.getByTestId(/^add-/).first().click()
  await page.getByTestId('cancel-carla').click()
  await expect(page.getByTestId('cancel-carla')).toHaveCount(0)
})

test('pages carry localized meta and language alternates', async ({ page }) => {
  await go(page, '/pt-BR')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /trilha de estudo/)
  await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveCount(1)
  await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveCount(1)
})

test('privacy and terms open without signing in, from the footer', async ({ page }) => {
  await go(page, '/')
  await page.getByTestId('footer-privacy').click()
  await expect(page).toHaveURL(/\/privacidade$/)
  await expect(page.getByTestId('legal-privacy')).toBeVisible()
  await page.getByTestId('footer-terms').click()
  await expect(page).toHaveURL(/\/termos$/)
  await expect(page.getByTestId('legal-terms')).toBeVisible()
  await go(page, '/pt-BR/privacidade')
  await expect(page.getByTestId('legal-privacy')).toBeVisible()
})
