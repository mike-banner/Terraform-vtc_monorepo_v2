import { test, expect, asDriver, asOwner } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { driverPhone } from './helpers/seed';

const PHRASE = 'SUPPRESSION COMPTE Elite Lyon (local)';

test.describe('profil propriétaire', () => {
  test.use(asOwner);

  test('voit l\'entreprise, sa fiche et la liste des chauffeurs', async ({ page }) => {
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { name: 'Elite Lyon (local)', level: 2 })).toBeVisible();
    await expect(page.getByTestId('own-driver-card')).toContainText('Test Owner');
    await expect(page.locator('[data-driver]', { hasText: 'Test Chauffeur' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zone de danger' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('suppression : la phrase exacte est exigée, la fonction n\'est appelée qu\'ensuite', async ({ page }) => {
    const native: string[] = [];
    page.on('dialog', (d) => {
      native.push(d.message());
      void d.dismiss();
    });
    let calls = 0;
    await page.route('**/functions/v1/delete-tenant-account', (route) => {
      calls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    // La déconnexion globale révoquerait la session partagée des tests : interceptée.
    await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Supprimer le compte entreprise' }).click();
    await page.getByRole('dialog', { name: 'Supprimer le compte entreprise ?' }).getByRole('button', { name: 'Continuer' }).click();

    const prompt = page.getByRole('dialog', { name: 'Supprimer le compte' });
    await expect(prompt.getByText(PHRASE)).toBeVisible();
    await prompt.getByRole('textbox').fill('suppression compte elite lyon (local)');
    await prompt.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('La phrase saisie ne correspond pas')).toBeVisible();
    expect(calls).toBe(0);

    await page.getByRole('button', { name: 'Supprimer le compte entreprise' }).click();
    await page.getByRole('dialog', { name: 'Supprimer le compte entreprise ?' }).getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('dialog', { name: 'Supprimer le compte' }).getByRole('textbox').fill(PHRASE);
    // La session reste valide (déconnexion interceptée) : /login peut renvoyer vers l'app, on guette donc la requête.
    const toLogin = page.waitForRequest((r) => new URL(r.url()).pathname === '/login' && r.isNavigationRequest());
    await page.getByRole('dialog', { name: 'Supprimer le compte' }).getByRole('button', { name: 'OK' }).click();
    await toLogin;
    expect(calls).toBe(1);
    expect(native).toEqual([]);
  });

  test('hors ligne : écritures désactivées', async ({ page, context }) => {
    await page.goto('/app/profile');
    await expect(page.getByTestId('own-driver-card')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Supprimer le compte entreprise' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Modifier ma fiche' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
    await context.setOffline(false);
  });
});

test.describe('profil chauffeur', () => {
  test.use(asDriver);

  test('modifie son téléphone, sans zone de danger ni liste d\'équipe', async ({ page }) => {
    const before = await driverPhone('Chauffeur');
    try {
      await page.goto('/app/profile');
      const card = page.getByTestId('own-driver-card');
      await expect(card).toContainText('Test Chauffeur');
      await expect(page.getByRole('heading', { name: 'Zone de danger' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Équipe et collaborateurs' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Modifier ma fiche' }).click();
      await expect(card.getByLabel('Prénom')).toHaveAttribute('readonly', '');
      await card.getByLabel('Téléphone').fill('abc');
      await card.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(card.getByText('Numéro de téléphone français invalide.')).toBeVisible();
      await card.getByLabel('Téléphone').fill('06 99 88 77 66');
      await card.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(card.getByText('06 99 88 77 66')).toBeVisible();
      expect(await driverPhone('Chauffeur')).toBe('06 99 88 77 66');
    } finally {
      await driverPhone('Chauffeur', before ?? '');
    }
  });
});
