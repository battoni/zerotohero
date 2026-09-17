import { expect, test } from '@playwright/test'

test('landing renders in English and Portuguese', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('landing-title')).toBeVisible()
  await page.goto('/pt-BR')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
})
