import { test, expect } from './fixtures/auth';
import './e2e-env';
import { collectConsoleErrors, expectNoHorizontalScroll } from './helpers/page-checks';

const email = process.env.E2E_OWNER_EMAIL!;
const password = process.env.E2E_OWNER_PASSWORD!;

async function fill(page: import('@playwright/test').Page, pwd: string) {
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(pwd);
}

test.describe('connexion et pages publiques React', () => {
  test('owner : connexion puis tableau de bord, sans défilement horizontal', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Espace Gestion', level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await fill(page, password);
    await page.getByRole('button', { name: 'Connexion', exact: true }).click();
    await page.waitForURL('**/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
    expect(errors().filter((e) => !/favicon/.test(e))).toEqual([]);
  });

  test('mauvais mot de passe : message, pas de redirection', async ({ page }) => {
    await page.goto('/login');
    await fill(page, 'mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Connexion', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
    expect(page.url()).toContain('/login');
    await expect(page.getByRole('button', { name: 'Connexion', exact: true })).toBeEnabled();
  });

  test('double clic : une seule requête de connexion', async ({ page }) => {
    let n = 0;
    page.on('request', (r) => r.url().includes('token?grant_type=password') && r.method() === 'POST' && n++);
    await page.goto('/login');
    await fill(page, password);
    await page.getByRole('button', { name: 'Connexion', exact: true }).dblclick();
    await page.waitForURL('**/app/dashboard');
    expect(n).toBe(1);
  });

  for (const [reason, text] of [
    ['suspended', 'Votre entreprise a été suspendue. Contactez le support.'],
    ['inactivity', 'Vous avez été déconnecté pour inactivité.'],
    ['expired', 'Votre session a expiré. Reconnectez-vous.'],
  ] as const) {
    test(`?reason=${reason} affiche son message`, async ({ page }) => {
      await page.goto(`/login?reason=${reason}`);
      await expect(page.getByRole('alert')).toHaveText(text);
    });
  }

  test('?error= est affiché comme texte, jamais interprété', async ({ page }) => {
    await page.goto('/login?error=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
    await expect(page.getByRole('alert')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('main img')).toHaveCount(0);
  });

  test('bouton démo absent sans variables de compilation', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Connexion', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /démo/i })).toHaveCount(0);
  });

  test('/onboarding mène à /signup', async ({ page }) => {
    // Non connecté, le middleware renvoie /onboarding vers /login : on teste la route React par navigation interne.
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Espace Gestion' })).toBeVisible();
    await page.evaluate(() => {
      history.pushState({}, '', '/onboarding');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForURL('**/signup');
    await expect(page.getByRole('heading', { name: 'Tes identifiants de connexion' })).toBeVisible();
  });

  test('/waiting-approval affiche l\'attente, sans défilement horizontal', async ({ page }) => {
    await page.goto('/waiting-approval');
    await expect(page.getByRole('heading', { name: "Dossier en cours d'examen", level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Modifier mon dossier' })).toHaveAttribute('href', '/signup?edit=true');
    await expectNoHorizontalScroll(page);
  });

  test('accueil public et chemin inconnu sans donnée de tenant', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Démarrer maintenant' })).toBeVisible();
    await page.getByRole('button', { name: 'En savoir plus' }).click();
    await expect(page.getByRole('heading', { name: 'Comptabilité' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto('/chemin-inconnu');
    await expect(page.getByText('Page introuvable')).toBeVisible();
  });
});
