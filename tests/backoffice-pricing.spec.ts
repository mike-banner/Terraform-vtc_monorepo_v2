import { test, expect, asOwner } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { activePolicy, pricingRule, resetPricing, restorePolicy } from './helpers/seed';

test.use(asOwner);

const row = (page: import('@playwright/test').Page, name: string) => page.locator('[data-row]:visible', { hasText: name });
const sheet = (page: import('@playwright/test').Page) => page.getByRole('dialog');

test.describe('tarifs', () => {
  test.beforeEach(async () => resetPricing());
  test.afterAll(async () => resetPricing());

  test('créer puis modifier une règle, sans fenêtre native ni défilement horizontal', async ({ page }) => {
    const native: string[] = [];
    page.on('dialog', (d) => {
      native.push(d.message());
      void d.dismiss();
    });
    await page.goto('/app/pricing');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await sheet(page).getByLabel('Nom du service').fill('e2e-gamme');
    await sheet(page).getByLabel('Base de départ (€)').fill('7.5');
    await sheet(page).getByLabel('Prix au km (€)').fill('2');
    await sheet(page).getByLabel('Course minimum (€)').fill('20');
    await sheet(page).getByRole('button', { name: 'Créer le tarif' }).click();
    await expect(row(page, 'E2E-GAMME')).toContainText('7.50 €');
    expect(await pricingRule('E2E-GAMME')).toMatchObject({ base_price: 7.5, price_per_km: 2, minimum_fare: 20, active: true });

    await row(page, 'E2E-GAMME').getByRole('button', { name: 'Modifier E2E-GAMME' }).click();
    await sheet(page).getByLabel('Base de départ (€)').fill('9');
    await sheet(page).getByLabel('Tarif actif').uncheck();
    await sheet(page).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(row(page, 'E2E-GAMME')).toContainText('9.00 €');
    await expect(row(page, 'E2E-GAMME')).toContainText('Inactif');
    expect(await pricingRule('E2E-GAMME')).toMatchObject({ base_price: 9, active: false });
    await expectNoHorizontalScroll(page);
    expect(native).toEqual([]);
  });

  test('validation : montant négatif refusé, rien créé', async ({ page }) => {
    await page.goto('/app/pricing');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await sheet(page).getByLabel('Nom du service').fill('e2e-neg');
    await sheet(page).getByLabel('Base de départ (€)').fill('-3');
    await sheet(page).getByRole('button', { name: 'Créer le tarif' }).click();
    await expect(sheet(page).getByText('Un montant ne peut pas être négatif.')).toBeVisible();
    expect(await pricingRule('E2E-NEG')).toBeNull();
  });

  test('politique d\'annulation : le propriétaire la modifie (nouvelle version)', async ({ page }) => {
    const before = await activePolicy();
    try {
      await page.goto('/app/pricing?tab=cancellation');
      await expect(page.getByRole('tab', { name: 'Annulation' })).toHaveAttribute('aria-selected', 'true');
      await page.getByLabel('Taux partiel (%)').fill('40');
      await page.getByRole('button', { name: 'Enregistrer la politique' }).click();
      await expect(page.getByText("Politique d'annulation enregistrée.")).toBeVisible();
      const after = await activePolicy();
      expect(Number(after.partial_refund_rate)).toBeCloseTo(0.4);
      expect(after.id).not.toBe(before.id);
      await expectNoHorizontalScroll(page);
    } finally {
      await restorePolicy(before.id as string);
    }
  });

  test('politique : pourcentage hors bornes refusé côté formulaire', async ({ page }) => {
    await page.goto('/app/pricing?tab=cancellation');
    await page.getByLabel('Taux partiel (%)').fill('150');
    await page.getByRole('button', { name: 'Enregistrer la politique' }).click();
    await expect(page.getByText('Un pourcentage va de 0 à 100.')).toBeVisible();
  });

  test('zones et transferts s\'ouvrent par bouton, onglet gardé dans l\'URL', async ({ page }) => {
    await page.goto('/app/pricing');
    await page.getByRole('tab', { name: 'Transferts' }).click();
    await expect(page).toHaveURL(/tab=transfers/);
    await page.getByRole('button', { name: 'Zones' }).click();
    await expect(sheet(page).getByRole('heading', { name: 'Zones' })).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await expect(sheet(page).getByRole('heading', { name: 'Nouveau forfait' })).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Transferts' })).toHaveAttribute('aria-selected', 'true');
  });

  test('hors ligne : ajout de tarif désactivé', async ({ page, context }) => {
    await page.goto('/app/pricing');
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
  });
});
