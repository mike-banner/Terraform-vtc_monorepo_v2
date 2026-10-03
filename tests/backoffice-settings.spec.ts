import { test, expect, asDriver, asOwner } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { restoreTenantSettings, tenantSettingsRow } from './helpers/seed';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('paramètres propriétaire', () => {
  test.use(asOwner);
  let snapshot: Record<string, unknown>;
  test.beforeAll(async () => {
    snapshot = await tenantSettingsRow();
  });
  test.afterEach(async () => restoreTenantSettings(snapshot));
  test.afterAll(async () => restoreTenantSettings(snapshot));

  test('forme juridique : la TVA affichée est celle relue du serveur', async ({ page }) => {
    const native: string[] = [];
    page.on('dialog', (d) => {
      native.push(d.message());
      void d.dismiss();
    });
    await page.goto('/app/settings');
    await page.getByLabel('Forme juridique').selectOption('sasu');
    await page.getByLabel('Numéro de TVA intracommunautaire').fill('FR12345678901');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Paramètres enregistrés.')).toBeVisible();
    const db = await tenantSettingsRow();
    expect(db).toMatchObject({ legal_form: 'sasu', is_vat_exempt: false, vat_number: 'FR12345678901' });
    await expect(page.getByTestId('vat-status')).toContainText(`Assujetti, ${db.vat_rate} %`);

    await page.getByLabel('Forme juridique').selectOption('auto_entrepreneur');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByTestId('vat-status')).toContainText('Exonéré (Art. 293 B CGI)');
    await expectNoHorizontalScroll(page);
    expect(native).toEqual([]);
  });

  test('adresse : enregistrée, et refusée si incomplète', async ({ page }) => {
    await page.goto('/app/settings');
    await page.getByLabel("Adresse de l'entreprise").fill('12 rue des Tests');
    await page.getByLabel('Code postal').fill('');
    await page.getByLabel('Ville').fill('Lyon');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText("Renseignez l'adresse, le code postal et la ville, ou aucun des trois.")).toBeVisible();

    await page.getByLabel('Code postal').fill('69002');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Paramètres enregistrés.')).toBeVisible();
    expect(await tenantSettingsRow()).toMatchObject({ address_line: '12 rue des Tests', postal_code: '69002', city: 'Lyon' });
  });

  test('logo : téléversé puis enregistré par la RPC', async ({ page }) => {
    await page.goto('/app/settings');
    await page.getByLabel('Choisir un logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('logo-img')).toHaveAttribute('src', /^blob:/);
    await page.getByRole('button', { name: 'Enregistrer le logo' }).click();
    await expect(page.getByText('Logo mis à jour.')).toBeVisible();
    await expect(page.getByTestId('logo-img')).toHaveAttribute('src', /logos\/.*\/logo\.png/);
    expect(String((await tenantSettingsRow()).logo_url)).toMatch(/logos\/.*\/logo\.png/);
  });

  test('logo : un SVG 1024x512 devient un PNG 512x256', async ({ page }) => {
    await page.goto('/app/settings');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><rect width="1024" height="512" fill="#123456"/></svg>');
    await page.getByLabel('Choisir un logo').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: svg });
    await page.getByRole('button', { name: 'Enregistrer le logo' }).click();
    await expect(page.getByText('Logo mis à jour.')).toBeVisible();
    const img = page.getByTestId('logo-img');
    await expect(img).toHaveAttribute('src', /logos\/.*\/logo\.png/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => `${el.naturalWidth}x${el.naturalHeight}`)).toBe('512x256');
  });

  test('logo : un fichier qui n’est pas une image est refusé', async ({ page }) => {
    await page.goto('/app/settings');
    await page.getByLabel('Choisir un logo').setInputFiles({ name: 'faux.png', mimeType: 'image/png', buffer: Buffer.from('pas une image') });
    await expect(page.getByText(/Image illisible/)).toBeVisible();
  });

  test('logo trop volumineux refusé', async ({ page }) => {
    await page.goto('/app/settings');
    await page.getByLabel('Choisir un logo').setInputFiles({ name: 'gros.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(page.getByText('Le fichier est trop volumineux (2 Mo maximum).')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer le logo' })).toHaveCount(0);
  });

  test('la section notifications est réservée : rien à l\'écran', async ({ page }) => {
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Fiscalité et adresse' })).toBeVisible();
    await expect(page.locator('[data-phase="18"]')).toBeHidden();
    await expect(page.getByText('Disponible prochainement')).toBeHidden();
  });

  test('hors ligne : enregistrement désactivé', async ({ page, context }) => {
    await page.goto('/app/settings');
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Changer le logo' })).toBeDisabled();
  });
});

test.describe('paramètres chauffeur', () => {
  test.use(asDriver);
  test('un chauffeur est redirigé hors de /app/settings', async ({ page }) => {
    await page.goto('/app/settings');
    await expect(page).not.toHaveURL(/\/app\/settings/);
  });
});
