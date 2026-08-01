import { test as base, expect, Page } from '@playwright/test';

export { expect };

export async function openAppLoggedIn(page: Page, path = '/index.html') {
  await page.goto(`${path}?forceMode=demo`);
  await page.waitForFunction(() => typeof (window as any).SJ_VERSION === 'string', null, { timeout: 10_000 });
  await page.locator('#demoLoginBtn').click();
  await expect(page.locator('#appContent')).toBeVisible({ timeout: 5_000 });
}

export async function goToSection(page: Page, section: string) {
  await page.locator(`[data-section="${section}"]`).click();
  await expect(page.locator(`[data-view-content="${section}"]`)).toBeVisible({ timeout: 5_000 });
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await openAppLoggedIn(page);
    await use(page);
  },
});
