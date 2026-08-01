import { test, expect, goToSection } from '../fixtures/app';

test.describe('Smoke: Fünf Ansichten rendern + Kern-Interaktion', () => {
  test('Dashboard: Countdown, nächste Termine, aktive Projekte, Frosch', async ({ appPage: page }) => {
    await goToSection(page, 'dashboard');
    await expect(page.locator('.countdown-card')).toBeVisible();
    await expect(page.getByText('Nächste Termine')).toBeVisible();
    await expect(page.getByText('Aktive Projekte')).toBeVisible();
    await expect(page.getByText('Frosch der Woche')).toBeVisible();
  });

  test('Träume: Grid rendert, Filter + neuer Traum anlegen', async ({ appPage: page }) => {
    await goToSection(page, 'dreams');
    await expect(page.locator('.item-card').first()).toBeVisible();

    // Filter nach Kategorie "Tango"
    await page.getByRole('button', { name: 'Tango', exact: true }).click();
    await expect(page.getByText('Tango-Festival in Buenos Aires besuchen')).toBeVisible();
    await expect(page.getByText('Vier Wochen durch Norwegen wandern')).toBeHidden();

    // zurück auf "alle" und neuen Traum anlegen
    await page.getByRole('button', { name: 'Alle Kategorien' }).click();
    await page.getByRole('button', { name: '+ Neuer Traum' }).click();
    await expect(page.locator('.modal-content')).toBeVisible();
    const uniqueTitle = 'E2E-Traum ' + Date.now();
    await page.locator('#dreamTitle').fill(uniqueTitle);
    await page.locator('.modal-content').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3_000 });
    await expect(page.getByText(uniqueTitle)).toBeVisible();
  });

  test('Timeline: Einträge rendern, neuer Termin anlegen', async ({ appPage: page }) => {
    await goToSection(page, 'timeline');
    await expect(page.locator('.timeline-item').first()).toBeVisible();

    await page.getByRole('button', { name: '+ Neuer Termin' }).click();
    await expect(page.locator('.modal-content')).toBeVisible();
    const uniqueTitle = 'E2E-Termin ' + Date.now();
    await page.locator('#evTitle').fill(uniqueTitle);
    await page.locator('#evStart').fill('2027-01-15');
    await page.locator('.modal-content').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3_000 });
    await expect(page.getByText(uniqueTitle)).toBeVisible();
  });

  test('Scanner-Board: Spalten rendern, Projekt bearbeiten', async ({ appPage: page }) => {
    await goToSection(page, 'board');
    await expect(page.getByText(/Aktiv \(\d\/3\)/)).toBeVisible();
    await expect(page.locator('.board-card').first()).toBeVisible();

    // Ein aktives Projekt ohne next_action zeigt die Warnmarkierung
    await expect(page.locator('.board-card.warn').first()).toBeVisible();

    const firstCard = page.locator('.board-card').first();
    await firstCard.getByRole('button', { name: 'Bearbeiten' }).click();
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.locator('#prTitle')).not.toHaveValue('');
    await page.locator('.modal-content').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.locator('.modal-content')).toBeHidden();
  });

  test('Woche: aktuelle Woche laden, Top-3 speichern, Rückblick sichtbar', async ({ appPage: page }) => {
    await goToSection(page, 'week');
    await expect(page.getByText('Diese Woche')).toBeVisible();
    const uniqueValue = 'E2E-Punkt ' + Date.now();
    const top3Inputs = page.locator('[data-view-content="week"] input[type="text"]');
    await top3Inputs.first().fill(uniqueValue);
    await page.getByRole('button', { name: 'Woche speichern' }).click();
    await expect(page.getByText('Woche gespeichert.')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Rückblick')).toBeVisible();
    await expect(page.locator('.past-week').first()).toBeVisible();
  });
});
