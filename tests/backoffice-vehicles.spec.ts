import { test, expect, asOwner } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { resetVehicles, seedVehicle, vehicleStatuses } from './helpers/seed';

test.use(asOwner);

// Les deux dispositions (cartes < md, tableau >= md) rendent la même ligne : on cible celle qui est visible.
const row = (page: import('@playwright/test').Page, plate: string) => page.locator('[data-row]:visible', { hasText: plate });
const sheet = (page: import('@playwright/test').Page) => page.getByRole('dialog');

test.describe('véhicules', () => {
  test.beforeEach(async () => resetVehicles());
  test.afterAll(async () => resetVehicles());

  test('créer un véhicule actif : l\'ancien devient inactif, un seul actif, sans rechargement', async ({ page }) => {
    await page.goto('/app/vehicles');
    await expect(row(page, 'AA-001-AA')).toContainText('Opérationnel');
    await page.evaluate(() => ((window as any).__marker = 1));
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await sheet(page).getByLabel('Marque').fill('Tesla');
    await sheet(page).getByLabel('Modèle').fill('Model S');
    await sheet(page).getByLabel("Plaque d'immatriculation").fill('E2E-100-AA');
    await sheet(page).getByRole('button', { name: 'Créer le véhicule' }).click();
    await expect(row(page, 'E2E-100-AA')).toContainText('Opérationnel');
    await expect(row(page, 'AA-001-AA')).toContainText('Hors service');
    expect(await page.evaluate(() => (window as any).__marker)).toBe(1);
    const statuses = await vehicleStatuses();
    expect(Object.values(statuses).filter((s) => s === 'active')).toHaveLength(1);
    expect(statuses['E2E-100-AA']).toBe('active');
  });

  test('modifier un véhicule', async ({ page }) => {
    await seedVehicle('E2E-200-AA', 'Avant');
    await page.goto('/app/vehicles');
    await row(page, 'E2E-200-AA').getByRole('button', { name: 'Modifier E2E-200-AA' }).click();
    await sheet(page).getByLabel('Modèle').fill('Après');
    await sheet(page).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(row(page, 'E2E-200-AA')).toContainText('Après');
  });

  test('supprimer avec confirmation, sans fenêtre native', async ({ page }) => {
    const native: string[] = [];
    page.on('dialog', (d) => {
      native.push(d.message());
      void d.dismiss();
    });
    await seedVehicle('E2E-300-AA', 'Jetable');
    await page.goto('/app/vehicles');
    await row(page, 'E2E-300-AA').getByRole('button', { name: 'Supprimer E2E-300-AA' }).click();
    await expect(page.getByRole('dialog', { name: 'Supprimer le véhicule ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(row(page, 'E2E-300-AA')).toBeVisible();
    await row(page, 'E2E-300-AA').getByRole('button', { name: 'Supprimer E2E-300-AA' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(row(page, 'E2E-300-AA')).toHaveCount(0);
    expect(native).toEqual([]);
  });

  test('validation : plaque vide refusée, rien créé', async ({ page }) => {
    await page.goto('/app/vehicles');
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await sheet(page).getByLabel('Marque').fill('Tesla');
    await sheet(page).getByLabel('Modèle').fill('Model 3');
    await sheet(page).getByRole('button', { name: 'Créer le véhicule' }).click();
    await expect(sheet(page).getByText('La plaque est obligatoire.')).toBeVisible();
    expect(Object.keys(await vehicleStatuses())).toEqual(['AA-001-AA']);
  });

  test('pas de défilement horizontal, liste et feuille ouverte', async ({ page }) => {
    await seedVehicle('E2E-400-AA', 'Très long nom de modèle pour éprouver la mise en page mobile');
    await page.goto('/app/vehicles');
    await expect(row(page, 'E2E-400-AA')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await expect(sheet(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('hors ligne : écritures désactivées', async ({ page, context }) => {
    await page.goto('/app/vehicles');
    await expect(row(page, 'AA-001-AA')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Nouveau' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Supprimer AA-001-AA' }).locator('visible=true')).toBeDisabled();
    await context.setOffline(false);
  });
});
