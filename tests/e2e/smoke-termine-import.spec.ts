import path from 'path';
import { test, expect, goToSection } from '../fixtures/app';

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'termine-import.json');

test.describe('Smoke: Termine-Import aus JSON-Datei', () => {
  test('Import zeigt Vorschau, übernimmt Termine, zweiter Import derselben Datei dupliziert nichts', async ({ appPage: page }) => {
    await goToSection(page, 'timeline');

    // --- Erster Import: 3 generische Fixture-Termine, keiner existiert bisher. ---
    await page.locator('#importEventsFile').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('3 Termine gefunden, 0 werden übersprungen (bereits vorhanden).')).toBeVisible();
    await expect(page.getByText('E2E Test Konzert Alpha')).toBeVisible();
    await expect(page.getByText('E2E Test Workshop Beta')).toBeVisible();
    await expect(page.getByText('E2E Test Familientreffen Gamma')).toBeVisible();

    await page.getByRole('button', { name: '3 Termine übernehmen' }).click();
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3_000 });
    await expect(page.getByText('3 Termine importiert, 0 übersprungen.')).toBeVisible({ timeout: 3_000 });

    // Alle drei Fixture-Termine erscheinen sofort in der Timeline, ohne Reload.
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Konzert Alpha' })).toBeVisible();
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Workshop Beta' })).toBeVisible();
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Familientreffen Gamma' })).toBeVisible();

    // --- Zweiter Import derselben Datei: alle 3 sind jetzt Duplikate, nichts wird angelegt. ---
    await page.locator('#importEventsFile').setInputFiles(FIXTURE_PATH);
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('3 Termine gefunden, 3 werden übersprungen (bereits vorhanden).')).toBeVisible();
    await expect(page.getByText('Alle gefundenen Termine sind bereits vorhanden')).toBeVisible();
    await expect(page.getByRole('button', { name: '0 Termine übernehmen' })).toBeDisabled();

    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.locator('.modal-content')).toBeHidden();

    // Jeder Fixture-Titel taucht weiterhin nur genau einmal auf — kein Duplikat angelegt.
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Konzert Alpha' })).toHaveCount(1);
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Workshop Beta' })).toHaveCount(1);
    await expect(page.locator('.timeline-item', { hasText: 'E2E Test Familientreffen Gamma' })).toHaveCount(1);
  });

  test('Kaputte Importdatei zeigt eine Fehlermeldung und importiert nichts', async ({ appPage: page }) => {
    await goToSection(page, 'timeline');
    const before = await page.locator('.timeline-item').count();

    // Buffer statt Datei: ungültiges JSON, direkt am Input gesetzt.
    await page.locator('#importEventsFile').setInputFiles({
      name: 'kaputt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ das ist kein json'),
    });

    await expect(page.getByText('Die Datei enthält kein gültiges JSON.')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.modal-content')).toBeHidden();
    await expect(page.locator('.timeline-item')).toHaveCount(before);
  });
});
