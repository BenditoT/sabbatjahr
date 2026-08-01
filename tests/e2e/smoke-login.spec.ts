import { test, expect } from '../fixtures/app';

test.describe('Smoke: Login (Demo-Modus)', () => {
  test('App lädt im Demo-Modus und zeigt den Demo-Login', async ({ page }) => {
    await page.goto('/index.html?forceMode=demo');
    await page.waitForFunction(() => typeof (window as any).SJ_VERSION === 'string');
    await expect(page.locator('#demoLoginBtn')).toBeVisible();
  });

  test('Demo starten führt zum Dashboard mit Countdown', async ({ page }) => {
    await page.goto('/index.html?forceMode=demo');
    await page.locator('#demoLoginBtn').click();
    await expect(page.locator('#appContent')).toBeVisible();
    await expect(page.locator('.day-x')).toContainText('Tag');
    await expect(page.locator('.day-x')).toContainText('von 409');
  });

  test('Keine Console-Errors beim Start', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/index.html?forceMode=demo');
    await page.locator('#demoLoginBtn').click();
    await expect(page.locator('#appContent')).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test('Alle 5 Navigations-Tabs sind vorhanden', async ({ appPage: page }) => {
    for (const section of ['dashboard', 'dreams', 'timeline', 'board', 'week']) {
      await expect(page.locator(`[data-section="${section}"]`)).toBeVisible();
    }
  });
});
