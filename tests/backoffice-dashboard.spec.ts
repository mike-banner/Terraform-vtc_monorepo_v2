import type { Page } from '@playwright/test';
import { test, expect, asOwner, asDriver } from './fixtures/auth';
import { collectConsoleErrors, expectNoHorizontalScroll, expectTouchTargets } from './helpers/page-checks';
import { cleanupByPrefix, restoreSetup, seedBooking, setStripeAccount, unconfigureTenant, updateBooking, type SetupSnapshot } from './helpers/seed';

// Tableau de bord React : mêmes fiche et cockpit que /app/bookings (annexe A, plan 16-07).
const DRIVER_ID = '55555555-5555-5555-5555-555555555555';
const TAG = 'db';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

test.use({ ...asOwner });
test.describe.configure({ mode: 'serial' });

const ids: Record<string, string> = {};
const dialog = (page: Page) => page.getByRole('dialog').first();
const section = (page: Page, name: string) => page.getByRole('region', { name });
const ref = (id: string) => `#${id.split('-')[0].toUpperCase()}`;

/** Stripe n'existe pas en local : la fonction est simulée pour que la carte soit déterministe. */
async function stubStripe(page: Page) {
  await page.route('**/functions/v1/create-stripe-onboarding', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ type: 'dashboard', url: 'https://stripe.test/d' }) }),
  );
}

async function gotoDashboard(page: Page) {
  await stubStripe(page);
  await page.goto('/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  await expect(section(page, 'Prochaines courses')).toBeVisible();
  await expectNoHorizontalScroll(page);
}

test.beforeAll(async () => {
  await setStripeAccount('acct_e2e_dashboard'); // la carte affiche « Dashboard Stripe » : compte déjà connecté
  cleanupByPrefix(TAG);
  const soon = new Date(Date.now() + 10 * 60_000).toISOString();
  const cur = { status: 'accepted', mission_status: 'not_started' };
  ids.late = (await seedBooking({ tag: `${TAG}-late`, ...cur, pickup_time: new Date(Date.now() - 30 * 60_000).toISOString() })).id;
  ids.up = (await seedBooking({ tag: `${TAG}-up`, ...cur, pickup_time: soon, driver_id: DRIVER_ID })).id;
  ids.hr = (await seedBooking({ tag: `${TAG}-hr`, booking_type: 'hourly', duration_hours: 2, pickup_time: new Date(Date.now() + 5 * 86_400_000).toISOString() })).id;
});
test.afterAll(async () => {
  await cleanupByPrefix(TAG);
  await setStripeAccount(null);
});
// Une mission démarrée masque le reste du tableau : état de départ rétabli après chaque test.
test.afterEach(() => updateBooking(ids.up, { mission_status: 'not_started', mission_note: null }));

test.describe('owner', () => {
  test('KPI, Stripe, aucune erreur console, pas de défilement horizontal, cibles de 44 px', async ({ page }, info) => {
    const errors = collectConsoleErrors(page);
    await gotoDashboard(page);
    const kpi = page.getByRole('group', { name: 'Indicateurs' });
    for (const label of ['Balance', 'Missions', 'Note']) await expect(kpi).toContainText(label);
    await expect(kpi).not.toContainText('–'); // les valeurs sont chargées
    await expect(page.getByRole('button', { name: /Dashboard Stripe/ })).toBeEnabled({ timeout: 15_000 }); // le bouton n'existe qu'après la réponse de l'info Stripe (squelette avant)
    if (info.project.name === 'backoffice-mobile') await expectTouchTargets(page, 'main button'); // la souris en desktop a des contrôles de 40 px
    expect(errors()).toEqual([]);
  });

  test('retard, prochaines courses et courses à valider', async ({ page }) => {
    await gotoDashboard(page);
    await expect(section(page, 'Course en retard')).toContainText('e2e-db-late');
    await expect(section(page, 'Prochaines courses')).toContainText('e2e-db-up');
    await expect(section(page, 'Actions requises')).toContainText('e2e-db-hr');
  });

  test('clic sur une course : même fiche que bookings, avec ?booking=', async ({ page }) => {
    await gotoDashboard(page);
    await section(page, 'Prochaines courses').getByRole('button', { name: /e2e-db-up/ }).click();
    await expect(page).toHaveURL(new RegExp(`booking=${ids.up}`));
    await expect(dialog(page)).toContainText(`Course ${ref(ids.up)}`);
    await expect(dialog(page).getByRole('button', { name: 'En route' })).toBeVisible();
    // La même fiche s'ouvre depuis la liste de bookings.
    await page.goto(`/app/bookings?booking=${ids.up}`);
    await expect(dialog(page)).toContainText(`Course ${ref(ids.up)}`);
    await expect(dialog(page).getByRole('button', { name: 'En route' })).toBeVisible();
  });

  test('« En route » depuis la fiche du dashboard : mission en cours sans rechargement', async ({ page }) => {
    await gotoDashboard(page);
    await page.evaluate(() => ((window as any).__marker = 1));
    await section(page, 'Prochaines courses').getByRole('button', { name: /e2e-db-up/ }).click();
    await dialog(page).getByRole('button', { name: 'En route' }).click();
    await expect(dialog(page).getByRole('button', { name: 'Terminer' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(section(page, 'Mission en cours')).toContainText('e2e-db-up');
    await expect(section(page, 'Prochaines courses')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__marker)).toBe(1);
  });

  test('écriture en base ailleurs : le tableau de bord suit', async ({ page }) => {
    await gotoDashboard(page);
    await updateBooking(ids.up, { mission_status: 'in_progress' });
    await expect(section(page, 'Mission en cours')).toContainText('e2e-db-up', { timeout: 20_000 });
    await updateBooking(ids.up, { mission_status: 'not_started' });
    await expect(section(page, 'Prochaines courses')).toContainText('e2e-db-up', { timeout: 20_000 });
  });

  test('hors ligne : données lisibles, actions désactivées', async ({ page, context }) => {
    await gotoDashboard(page);
    await section(page, 'Prochaines courses').getByRole('button', { name: /e2e-db-up/ }).click();
    await expect(dialog(page).getByRole('button', { name: 'En route' })).toBeEnabled();
    await context.setOffline(true);
    try {
      await expect(dialog(page).getByRole('note').filter({ hasText: 'Hors ligne' })).toBeVisible();
      await expect(dialog(page).getByRole('button', { name: 'En route' })).toBeDisabled();
      await expect(dialog(page)).toContainText('e2e-db-up');
      await page.keyboard.press('Escape');
      await expect(section(page, 'Prochaines courses')).toContainText('e2e-db-up');
      await expect(page.getByRole('button', { name: /Dashboard Stripe/ })).toBeDisabled();
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe('chauffeur', () => {
  test.use({ ...asDriver });

  test('voit son tableau de bord et sa course à venir', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByRole('group', { name: 'Indicateurs' })).toBeVisible();
    await expect(section(page, 'Prochaines courses')).toContainText('e2e-db-up');
    await section(page, 'Prochaines courses').getByRole('button', { name: /e2e-db-up/ }).click();
    await expect(dialog(page)).toContainText(`Course ${ref(ids.up)}`);
  });
});

test.describe('owner non configuré', () => {
  let snap: SetupSnapshot;
  test.beforeAll(async () => {
    snap = await unconfigureTenant();
  });
  test.afterAll(async () => {
    if (snap) await restoreSetup(snap);
  });

  test('redirigé vers /app/setup', async ({ page }) => {
    await stubStripe(page);
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app\/setup$/);
  });
});
