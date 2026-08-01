import { test, expect, goToSection } from '../fixtures/app';

test.describe('Smoke: WIP-Limit-Dialog (max. 3 aktive Projekte)', () => {
  test('4. Projekt auf Aktiv setzen zeigt den WIP-Dialog', async ({ appPage: page }) => {
    await goToSection(page, 'board');
    // Demo-Daten: 3 Projekte sind bereits "aktiv". Ein Projekt aus "Idee" (Status-Select)
    // auf "aktiv" umstellen muss den WIP-Dialog auslösen statt den Status zu ändern.
    await expect(page.getByText(/Aktiv \(3\/3\)/)).toBeVisible();

    const ideaColumn = page.locator('[data-board-col="idee"]');
    const ideaCard = ideaColumn.locator('.board-card').first();
    await expect(ideaCard).toBeVisible();
    await ideaCard.locator('select').selectOption('aktiv');

    await expect(page.getByText('WIP-Limit erreicht')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Erst eins abschließen oder pausieren')).toBeVisible();

    // Der Status darf NICHT geändert worden sein — weiterhin genau 3 aktive Projekte.
    await page.getByRole('button', { name: 'Verstanden' }).click();
    await expect(page.getByText('WIP-Limit erreicht')).toBeHidden();
    await expect(page.getByText(/Aktiv \(3\/3\)/)).toBeVisible();
  });

  test('Abschluss eines aktiven Projekts löst Konfetti/Erfolgsmeldung aus und macht Platz', async ({ appPage: page }) => {
    await goToSection(page, 'board');
    const activeColumn = page.locator('[data-board-col="aktiv"]');
    const firstActiveCard = activeColumn.locator('.board-card').first();
    await firstActiveCard.locator('select').selectOption('abgeschlossen');
    await expect(page.getByText('Geschafft! Projekt abgeschlossen.')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/Aktiv \(2\/3\)/)).toBeVisible();

    // Jetzt ist wieder Platz — Idee-Projekt auf aktiv setzen funktioniert ohne Dialog.
    const ideaColumn = page.locator('[data-board-col="idee"]');
    const ideaCard = ideaColumn.locator('.board-card').first();
    if (await ideaCard.count()) {
      await ideaCard.locator('select').selectOption('aktiv');
      await expect(page.getByText('WIP-Limit erreicht')).toHaveCount(0);
      await expect(page.getByText(/Aktiv \(3\/3\)/)).toBeVisible();
    }
  });
});

test.describe('Smoke: ESC schließt Modals', () => {
  test('ESC schließt das Traum-Modal', async ({ appPage: page }) => {
    await goToSection(page, 'dreams');
    await page.getByRole('button', { name: '+ Neuer Traum' }).click();
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-content')).toBeHidden();
  });

  test('ESC schließt zuerst den WIP-Dialog, App bleibt sonst unverändert', async ({ appPage: page }) => {
    await goToSection(page, 'board');
    const ideaColumn = page.locator('[data-board-col="idee"]');
    const ideaCard = ideaColumn.locator('.board-card').first();
    await ideaCard.locator('select').selectOption('aktiv');
    await expect(page.getByText('WIP-Limit erreicht')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('WIP-Limit erreicht')).toBeHidden();
  });
});
