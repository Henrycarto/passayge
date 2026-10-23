import { actAs, expect, test } from './fixtures';

test.describe('first-visit tour', () => {
  test('opens on the first visit, walks five steps and can be reopened from Help', async ({ fresh: page }) => {
    await page.goto('/');
    const tour = page.getByRole('dialog', { name: 'Find a patient' });
    await expect(tour).toBeVisible();
    await expect(tour.getByText('Step 1 of 5')).toBeVisible();
    // Never blocks: the page behind it still works.
    await expect(page.getByRole('link', { name: 'About' })).toBeEnabled();

    const titles = ['Insert the e-card', 'Open documents', 'Read the audit log', 'See the network view'];
    for (const t of titles) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('dialog', { name: t })).toBeVisible();
    }
    await expect(page).toHaveURL(/\/patients\/pas-theresia/);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog', { name: /See the network view/ })).toBeHidden();

    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeHidden();

    await page.getByRole('button', { name: 'Help' }).click();
    await page.getByRole('menuitem', { name: 'Take the tour' }).click();
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeVisible();
  });

  test('Escape skips the tour', async ({ fresh: page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeHidden();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Find a patient' })).toBeHidden();
  });
});

test.describe('access', () => {
  test('a doctor without contact is denied, inserts the e-card and gets access; both are logged', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await actAs(page, /Wimmer/);
    const banner = page.getByRole('status').filter({ hasText: /access/i });
    await expect(banner).toContainText('No access');
    await expect(banner).toContainText('Insert the e-card to request access.');
    await expect(page.getByRole('heading', { name: 'Documents are locked' })).toBeVisible();
    await expect(page.getByText('No contact confirmation from this provider for this patient.')).toBeVisible();

    await page.getByRole('button', { name: 'Insert e-card' }).click();
    await expect(banner).toContainText('Access granted');
    await expect(page.getByRole('table').getByText('Discharge letter, physician')).toBeVisible();

    await page.getByRole('link', { name: /Audit and network log/ }).click();
    const rows = page.locator('table.audit tbody tr.row').filter({ hasText: 'Dr. Johannes Wimmer' });
    await expect(rows.filter({ hasText: 'Recorded contact confirmation' })).toHaveCount(1);
    // Newest first: the granted search comes after the contact, the refusal before it.
    const texts = await rows.allInnerTexts();
    const granted = texts.findIndex((t) => t.includes('Searched documents') && t.includes('Granted'));
    const recorded = texts.findIndex((t) => t.includes('Recorded contact confirmation'));
    const denied = texts.findIndex((t) => t.includes('Searched documents') && t.includes('Denied') && t.includes('No contact confirmation'));
    expect(granted).toBeGreaterThanOrEqual(0);
    expect(granted).toBeLessThan(recorded);
    expect(recorded).toBeLessThan(denied);
  });

  test('a pharmacy sees medication only, and documents are not even offered', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await actAs(page, /Gruber/);
    await expect(page.getByRole('tab', { name: /Documents/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Medication/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Metformin')).toBeVisible();
  });

  test('moving the clock 28 days ends the pharmacy window', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await actAs(page, /Gruber/);
    await expect(page.getByText('Metformin')).toBeVisible();
    await page.getByRole('button', { name: '+28 days' }).click();
    await expect(page.getByRole('heading', { name: 'Medication access expired' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /access/i })).toContainText('Access expired');
  });

  test('an entered-in-error report is struck through and warns before its values', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await page.getByRole('button', { name: 'Laboratory report' }).nth(1).click();
    await expect(page.getByRole('note')).toContainText('Entered in error.');
    await expect(page.locator('.reader').getByText('11.2 mg/dL')).toHaveCount(0);
  });

  test('abnormal lab results show with a flag in words', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await expect(page.getByText('4 results out of range')).toBeVisible();
    await page.getByRole('button', { name: 'Laboratory report' }).first().click();
    await expect(page.getByRole('region', { name: 'Lab result: HbA1c' })).toContainText('High');
  });
});

test.describe('keyboard and tooltips', () => {
  test('/ focuses search, G L opens the log, J and K move through it', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(page.getByRole('textbox', { name: 'Find a patient' })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('g');
    await page.keyboard.press('l');
    await expect(page).toHaveURL(/\/log\?patient=pas-theresia/);
    // Let the audit log finish loading before moving through it (this raced under load once).
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table.audit tbody tr.row').nth(1)).toBeVisible();
    await expect(page.locator('table.audit tbody tr.row').first()).toHaveClass(/sel/);
    await page.keyboard.press('j');
    await expect(page.locator('table.audit tbody tr.row').nth(1)).toHaveClass(/sel/);
    await page.keyboard.press('k');
    await expect(page.locator('table.audit tbody tr.row').first()).toHaveClass(/sel/);
  });

  test('a term tooltip opens on focus and closes with Escape', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    const term = page.getByRole('button', { name: 'Contact confirmation' });
    await term.focus();
    const tip = page.getByRole('tooltip').filter({ hasText: 'Kontaktbestätigung' });
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });

  test('an IHE transaction explains itself on hover', async ({ returning: page }) => {
    await page.goto('/patients/pas-theresia');
    await page.locator('.peek .ihe').hover();
    await expect(page.getByRole('tooltip').filter({ hasText: /IHE MHD|IHE PDQm|audit log/ })).toBeVisible();
  });
});
