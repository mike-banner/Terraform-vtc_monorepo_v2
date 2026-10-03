import { test, expect, asOwner } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { restoreSetup, tenantSetupRow, unconfigureTenant, type SetupSnapshot } from './helpers/seed';

test.use(asOwner);
test.describe.configure({ mode: 'serial' });

const item = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-prerequisite="${id}"]`);

test.describe('première connexion guidée', () => {
  let snap: SetupSnapshot;
  test.beforeAll(async () => {
    snap = await unconfigureTenant();
  });
  test.afterAll(async () => {
    if (snap) await restoreSetup(snap);
  });

  test('owner non configuré : redirigé vers /app/setup, la liste montre les éléments manquants', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app\/setup$/);
    for (const id of ['legal', 'vehicle', 'pricing']) await expect(item(page, id)).toHaveAttribute('data-done', 'false');
    await expect(item(page, 'legal')).toBeFocused();
  });

  test('mise en avant animée seulement sans prefers-reduced-motion ; pas de défilement horizontal', async ({ page }) => {
    const anim = () => item(page, 'legal').evaluate((el) => getComputedStyle(el).animationName);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/app/setup');
    await expect(item(page, 'legal')).toBeVisible();
    expect(await anim()).not.toBe('none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await anim()).toBe('none');
    await expectNoHorizontalScroll(page);
  });

  test('identité invalide : erreur en français, rien enregistré', async ({ page }) => {
    await page.goto('/app/setup');
    await page.getByLabel('SIRET').fill('123');
    await page.getByLabel('Carte professionnelle VTC').fill('123456789012');
    await page.getByRole('button', { name: "Enregistrer l'identité" }).click();
    await expect(page.getByText('Le SIRET compte 14 chiffres.')).toBeVisible();
    expect((await tenantSetupRow()).setup_completed).toBe(false);
  });

  test('identité légale enregistrée par complete_tenant_setup, sans rechargement', async ({ page }) => {
    await page.goto('/app/setup');
    await page.evaluate(() => ((window as any).__marker = 1));
    await page.getByLabel('SIRET').fill('123 456 789 00012');
    await page.getByLabel('Carte professionnelle VTC').fill('123 456 789 012');
    await page.getByRole('button', { name: "Enregistrer l'identité" }).click();
    await expect(item(page, 'legal')).toHaveAttribute('data-done', 'true');
    expect(await page.evaluate(() => (window as any).__marker)).toBe(1);
    const row = await tenantSetupRow();
    expect(row.setup_completed).toBe(true);
    expect(row.siret).toBe('12345678900012');
  });

  test('véhicule et tarif créés par les formulaires partagés, liste mise à jour sans rechargement', async ({ page }) => {
    await page.goto('/app/setup');
    await page.evaluate(() => ((window as any).__marker = 1));
    await page.getByLabel('Marque').fill('Tesla');
    await page.getByLabel('Modèle').fill('Model S');
    await page.getByLabel("Plaque d'immatriculation").fill('E2E-900-AA');
    await page.getByRole('button', { name: 'Créer le véhicule' }).click();
    await expect(item(page, 'vehicle')).toHaveAttribute('data-done', 'true');
    await page.getByLabel('Nom du service').fill('E2ESETUP');
    await page.getByLabel('Base de départ (€)').fill('10');
    await page.getByLabel('Prix au km (€)').fill('2');
    await page.getByLabel('Course minimum (€)').fill('20');
    await page.getByLabel('Taux horaire, mise à disposition (€)').fill('40');
    await page.getByRole('button', { name: 'Créer le tarif' }).click();
    await expect(item(page, 'pricing')).toHaveAttribute('data-done', 'true');
    expect(await page.evaluate(() => (window as any).__marker)).toBe(1);
    await expect(page.getByRole('link', { name: 'Terminer et ouvrir le tableau de bord' })).toBeVisible();
  });

  test('tout rempli : accès au tableau de bord', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  });
});
