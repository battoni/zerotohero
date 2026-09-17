import type { Page } from '@playwright/test'

/** Navigate and wait until the client app has hydrated (data loads client-side). */
export async function go(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => {
    const el = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return !!el?.__vue_app__
  })
}

export async function enterDemo(page: Page) {
  await go(page, '/')
  await page.getByTestId('landing-demo').click()
  await page.waitForURL('**/tracks')
  await page.getByTestId('home-tracks').waitFor()
}
