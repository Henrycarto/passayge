import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const PAGES = ['/', '/patients/pas-theresia', '/patients/pas-maria', '/log?patient=pas-theresia', '/log/network', '/about'];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 } };

for (const theme of ['light', 'dark'] as const) {
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    test(`axe: every page, ${theme}, ${vp}`, async ({ returning: page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(size);
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      }
    });
  }

  test(`axe: tour, tooltip and glossary open, ${theme}`, async ({ fresh: page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/patients/pas-theresia');
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeVisible();
    let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Contact confirmation' }).focus();
    await page.getByRole('link', { name: 'Glossary' }).click();
    r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
}

test('no request leaves the sandbox', async ({ fresh: page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol === 'data:') return;
    if (u.origin !== origin) outside.push(req.url());
    // No personal data in any request: no email address anywhere in URL or body.
    if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(req.url() + (req.postData() ?? ''))) outside.push(`personal data in ${req.url()}`);
  });
  // A full session: tour, search, chart, documents, e-card, settings, clock, log, glossary, about.
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Find a patient' }).fill('Unterberger');
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: /UNTERBERGER, Herta/ }).first().click();
  await page.getByRole('button', { name: 'Discharge letter, physician' }).click();
  await page.getByRole('button', { name: /Insert e-card/ }).click();
  await page.getByRole('button', { name: 'Change as patient' }).click();
  await page.getByRole('group', { name: 'Access portal, simulated' }).getByLabel('Documents').check();
  await page.getByRole('button', { name: '+1 day' }).click();
  await page.goto('/log?patient=pas-herta');
  await page.goto('/log/network');
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByRole('menuitem', { name: 'Glossary' }).click();
  await page.goto('/about');
  await page.waitForLoadState('networkidle');
  expect(outside).toEqual([]);
});
