import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ fresh: Page; returning: Page }>({
  // A first-time visitor: the tour opens.
  fresh: async ({ page, request }, use) => {
    await request.post('/api/reset', { data: {} });
    await use(page);
  },
  // A returning visitor: tour already done.
  returning: async ({ page, request }, use) => {
    await request.post('/api/reset', { data: {} });
    await page.addInitScript(() => localStorage.setItem('passayge.tour.done', '1'));
    await use(page);
  },
});

export { expect };

export async function actAs(page: Page, providerName: RegExp) {
  const select = page.getByLabel('Acting as');
  const value = await select.locator('option', { hasText: providerName }).getAttribute('value');
  await select.selectOption(value!);
}
