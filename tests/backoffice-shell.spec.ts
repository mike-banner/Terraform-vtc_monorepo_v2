import { test, expect, asOwner } from './fixtures/auth';
import { collectConsoleErrors, expectNoHorizontalScroll, expectTouchTargets } from './helpers/page-checks';
import { loginAs } from './helpers/session';
import { setTenantStatus } from './helpers/seed';

test.use(asOwner);

const shell = (page: import('@playwright/test').Page) => page.locator('[data-app-shell]');
// Navigation interne simulée : le routeur écoute popstate.
const pushRoute = (page: import('@playwright/test').Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test.describe('coque React', () => {
  test('spike : attrape-tout derrière les pages Astro et le refus par défaut', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.locator('main').first()).toBeVisible();
    await expect(shell(page)).toHaveCount(0); // page Astro spécifique prioritaire
    await page.goto('/app/inexistant');
    expect(page.url()).toContain('/app/dashboard?denied=1'); // middleware avant l'attrape-tout
  });

  test('vehicles rendu par React, titre, retour, pas de défilement horizontal', async ({ page }, info) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/app/vehicles');
    await expect(shell(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Véhicules', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    if (info.project.name === 'backoffice-mobile') await expectTouchTargets(page, '[data-bottom-nav] a');
    expect(errors()).toEqual([]);
  });

  test('lien vers une page Astro = chargement complet, retour vers vehicles', async ({ page }) => {
    await page.goto('/app/vehicles');
    await expect(shell(page)).toBeVisible();
    await page.evaluate(() => ((window as any).__marker = 1));
    await page.getByRole('link', { name: 'Tarifs' }).click();
    await page.waitForURL('**/app/pricing');
    expect(await page.evaluate(() => (window as any).__marker)).toBeUndefined();
    await page.goBack();
    await expect(shell(page)).toBeVisible();
    expect(page.url()).toContain('/app/vehicles');
  });

  test('hors ligne : indicateur visible', async ({ page, context }) => {
    await page.goto('/app/vehicles');
    await expect(shell(page)).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toBeVisible();
    await context.setOffline(false);
  });

  test('session supprimée puis retour au premier plan : /login?reason=expired', async ({ page, context }) => {
    await page.goto('/app/vehicles');
    await expect(shell(page)).toBeVisible();
    await context.clearCookies();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    await page.waitForURL('**/login?reason=expired');
  });

  test('tenant suspendu puis retour au premier plan : /login?reason=suspended', async ({ page, browser }) => {
    try {
      await page.goto('/app/vehicles');
      await expect(shell(page)).toBeVisible();
      await setTenantStatus('suspended');
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
      await page.waitForURL('**/login?reason=suspended');
    } finally {
      await setTenantStatus('active');
      // La déconnexion révoque les sessions de l'utilisateur : régénérer les états partagés.
      await loginAs('owner', browser);
      await loginAs('driver', browser);
    }
  });

  test('temps réel : le canal survit à la navigation entre routes React', async ({ page }) => {
    let joins = 0;
    page.on('websocket', (ws) => ws.on('framesent', (f) => typeof f.payload === 'string' && f.payload.includes('phx_join') && joins++));
    await page.goto('/app/vehicles');
    await expect(shell(page)).toBeVisible();
    await expect.poll(() => joins, { timeout: 15_000 }).toBeGreaterThan(0);
    const before = joins;
    await pushRoute(page, '/app/introuvable');
    await expect(page.getByText('Page introuvable')).toBeVisible();
    await pushRoute(page, '/app/vehicles');
    await expect(page.getByRole('heading', { name: 'Véhicules', level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(joins).toBe(before);
  });
});
