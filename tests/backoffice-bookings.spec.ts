import type { Page } from '@playwright/test';
import { test, expect, asOwner, asDriver } from './fixtures/auth';
import { expectNoHorizontalScroll, expectTouchTargets } from './helpers/page-checks';
import { cleanupByPrefix, seedBooking, updateBooking } from './helpers/seed';

// Fiche seed du chauffeur de test (supabase/seed) : les courses qui lui sont affectées sont les siennes.
const DRIVER_ID = '55555555-5555-5555-5555-555555555555';
const TAG = 'bk';
const XSS_NAME = `e2e-bk-xss <img src=x onerror="window.__xss=1">`;

// Fuseau du navigateur volontairement éloigné de Paris : l'affichage doit rester en Europe/Paris.
test.use({ ...asOwner, timezoneId: 'America/Los_Angeles' });

const ids: Record<string, string> = {};
const h = (n: number) => new Date(Date.now() + 3 * 86_400_000 + n * 5 * 3_600_000).toISOString();
const row = (page: Page, name: string) => page.locator('[data-row]:visible', { hasText: `e2e-bk-${name}` });
const rowsVisible = (page: Page) => page.locator('[data-row]:visible');
const dialog = (page: Page) => page.getByRole('dialog');

async function gotoList(page: Page, qs = '') {
  await page.goto(`/app/bookings${qs}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(rowsVisible(page).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
}

test.beforeAll(async () => {
  cleanupByPrefix(TAG);
  const cur = { status: 'accepted', mission_status: 'not_started' };
  // Remplissage pour la pagination, créé en premier : ces courses sont les plus anciennes.
  for (let i = 0; i < 12; i++) await seedBooking({ tag: `${TAG}-p${String(i).padStart(2, '0')}`, ...cur, pickup_time: h(40 + i) });
  const mk = async (key: string, o: Record<string, unknown> = {}) => {
    ids[key] = (await seedBooking({ tag: `${TAG}-${key}`, ...cur, ...o })).id;
  };
  // Sans ledger : carte + statut accepted (pas de mouvement créé à l'insertion).
  await mk('done', { mission_status: 'completed', payment_mode: 'card', pickup_time: h(1), invoice_number: 'FAC-2026-E2E1' });
  await mk('rated', { mission_status: 'completed', payment_mode: 'card', pickup_time: h(2), rating: 4, rating_comment: 'Très bien', rating_created_at: new Date().toISOString() });
  await mk('instr', {
    pickup_time: '2026-12-15T09:30:00Z',
    instructions: 'Sonner deux fois',
    mission_note: '[terrain] en_route_at=2026-12-15T09:00:00Z\nBagage fragile',
    phone: '+33 6 12 34 56 78',
  });
  await mk('al', { pickup_time: h(3), address_alert: 'hors_zone_depart' });
  await mk('hr', { pickup_time: h(4), status: 'pending', mission_status: 'to_validate', booking_type: 'hourly', duration_hours: 2 });
  await mk('xss', { pickup_time: h(5), lastName: XSS_NAME });
  // Même créneau, même chauffeur : conflit pour owner/manager ; visibles du chauffeur.
  const cf = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await mk('cf1', { pickup_time: cf, driver_id: DRIVER_ID });
  await mk('cf2', { pickup_time: cf, driver_id: DRIVER_ID });
  await mk('rf', { pickup_time: h(6), status: 'refund_failed' });
  await mk('late', { pickup_time: new Date(Date.now() - 30 * 60_000).toISOString() });
  await mk('cx', { pickup_time: h(7), status: 'cancelled' });
});

test.afterAll(() => cleanupByPrefix(TAG));

test.describe('liste (owner)', () => {
  test("A1 filtre statut dans l'URL", async ({ page }) => {
    await gotoList(page);
    await page.getByLabel('Statut').selectOption('not_started');
    await expect(page).toHaveURL(/status=not_started/);
    await expect(row(page, 'late')).toBeVisible();
    await expect(row(page, 'hr')).toHaveCount(0);
    await gotoList(page, '?status=to_validate');
    await expect(row(page, 'hr')).toBeVisible();
    await expect(row(page, 'late')).toHaveCount(0);
    await expect(page.getByLabel('Statut')).toHaveValue('to_validate');
  });

  test('A1 annulées à part sauf refund_failed', async ({ page }) => {
    await gotoList(page);
    await expect(row(page, 'rf')).toBeVisible();
    await expect(row(page, 'cx')).toHaveCount(0);
    await gotoList(page, '?status=cancelled');
    await expect(row(page, 'cx')).toBeVisible();
    await expect(row(page, 'rf')).toBeVisible();
    await expect(row(page, 'rf')).toContainText('Échec remboursement');
  });

  test('A1 filtre type', async ({ page }) => {
    await gotoList(page);
    await page.getByLabel('Type').selectOption('hourly');
    await expect(page).toHaveURL(/type=hourly/);
    await expect(row(page, 'hr')).toBeVisible();
    await expect(row(page, 'late')).toHaveCount(0);
    await expect(row(page, 'hr')).toContainText('Mise à dispo');
  });

  test('A1 pagination par 10 et compteur', async ({ page }) => {
    await gotoList(page);
    await expect(rowsVisible(page)).toHaveCount(10);
    const text = (await page.getByText(/^\d+ courses?$/).innerText()).trim();
    const total = Number(text.split(' ')[0]);
    expect(total).toBeGreaterThanOrEqual(22);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 \//)).toBeVisible();
    await expect(rowsVisible(page)).toHaveCount(Math.min(10, total - 10));
    await page.getByRole('button', { name: 'Précédent' }).click();
    await expect(page).not.toHaveURL(/page=/);
  });

  test('A1 badge adresse à vérifier', async ({ page }) => {
    await gotoList(page);
    await expect(row(page, 'al')).toContainText('Adresse à vérifier');
    await expect(row(page, 'late')).not.toContainText('Adresse à vérifier');
  });

  test('A1 badge conflit owner seulement', async ({ page }) => {
    await gotoList(page);
    await expect(row(page, 'cf1')).toContainText('Conflit');
    await expect(row(page, 'cf2')).toContainText('Conflit');
    await expect(row(page, 'al')).not.toContainText('Conflit');
  });

  test('A1 liseré de retard', async ({ page }) => {
    await gotoList(page);
    const classes = (name: string) => row(page, name).evaluate((el) => `${el.className} ${el.firstElementChild?.className ?? ''}`);
    expect(await classes('late')).toContain('border-destructive');
    expect(await classes('al')).not.toContain('border-destructive');
  });

  test('A1 cibles tactiles et pas de défilement horizontal', async ({ page }, info) => {
    await gotoList(page);
    if (info.project.name === 'backoffice-mobile') {
      await expectTouchTargets(page, 'li[data-row] > button');
      await expectTouchTargets(page, 'nav[aria-label="Pagination"] button');
      await expectTouchTargets(page, 'main select');
      await expectTouchTargets(page, 'main input[type="search"]');
    }
    await expectNoHorizontalScroll(page);
  });
});

test.describe('recherche', () => {
  test('A2 recherche par nom et référence', async ({ page }) => {
    await gotoList(page);
    const search = page.getByLabel('Recherche');
    await search.fill('e2e-bk-instr');
    await expect(row(page, 'instr')).toBeVisible();
    await expect(rowsVisible(page)).toHaveCount(1);
    await expect(page.getByText('1 résultat')).toBeVisible();
    await search.fill('FAC-2026-E2E1');
    await expect(row(page, 'done')).toBeVisible();
    await expect(rowsVisible(page)).toHaveCount(1);
    await search.fill('+33 6 12');
    await expect(row(page, 'instr')).toBeVisible();
    await search.fill('e');
    await expect(page.getByLabel('Statut')).toBeVisible(); // moins de 2 caractères : la liste revient
  });

  test('A2 recherche avec caractères spéciaux', async ({ page }) => {
    await gotoList(page);
    await page.getByLabel('Recherche').fill('e2e,bk)(%*\\zz');
    await expect(page.getByText('Aucun résultat')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test("A2 XSS : un nom <img onerror> s'affiche en texte", async ({ page }) => {
    await gotoList(page);
    await expect(row(page, 'xss')).toContainText('<img src=x onerror=');
    await page.getByLabel('Recherche').fill('e2e-bk-xss');
    await expect(row(page, 'xss')).toBeVisible();
    await expect(page.locator('main img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});

test.describe('fiche', () => {
  test('A3 fiche ouverte par ?booking=', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.instr}`);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('heading', { name: /^Course #[0-9A-F]{8}$/ })).toBeVisible();
    await expect(dialog(page)).toContainText('e2e-bk-instr');
    await expect(dialog(page).getByRole('link', { name: '+33 6 12 34 56 78' })).toHaveAttribute('href', 'tel:+33612345678');
    await expect(dialog(page).getByRole('link', { name: 'Itinéraire Google Maps' })).toHaveAttribute('href', /google\.com\/maps\/dir/);
    await expect(dialog(page)).toContainText('Départ e2e');
    await expectNoHorizontalScroll(page);
  });

  test('A3 ouverture au clic sur une ligne', async ({ page }) => {
    await gotoList(page);
    await row(page, 'al').getByRole('button').first().click();
    await expect(page).toHaveURL(new RegExp(`booking=${ids.al}`));
    await expect(dialog(page)).toBeVisible();
  });

  test('A3 instructions en tête et historique', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.instr}`);
    await expect(dialog(page)).toContainText('Sonner deux fois');
    const text = await dialog(page).innerText();
    expect(text.indexOf('Sonner deux fois')).toBeLessThan(text.indexOf('Trajet'));
    expect(text).toMatch(/En route le /);
    expect(text).toContain('Note : Bagage fragile');
  });

  test('A3 heure Europe/Paris', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.instr}`);
    // 09:30 UTC le 15/12 = 10:30 à Paris, quel que soit le fuseau du navigateur (ici Los Angeles).
    await expect(dialog(page)).toContainText('15 décembre 2026');
    await expect(dialog(page)).toContainText('10:30');
  });

  test("A4 alerte d'adresse affichée", async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.al}`);
    await expect(dialog(page).getByText('Adresse de départ hors de la zone du trajet choisi')).toBeVisible();
  });

  test('A5 conflit affiché', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.cf1}`);
    await expect(dialog(page).getByText('Conflit de créneau avec :')).toBeVisible();
    await expect(dialog(page)).toContainText('Départ e2e');
  });

  test('A11 QR ou note sur course terminée', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.done}`);
    await expect(dialog(page).getByText('Faire noter la course')).toBeVisible();
    await expect(dialog(page).locator('svg[role="img"]').filter({ has: page.locator('title', { hasText: 'QR de notation' }) })).toHaveCount(1);
    await page.goto(`/app/bookings?booking=${ids.rated}`);
    await expect(dialog(page).getByRole('img', { name: 'Note : 4 sur 5' })).toBeVisible();
    await expect(dialog(page)).toContainText('Très bien');
  });

  test('A14 Échap et bouton Fermer', async ({ page }, info) => {
    await gotoList(page);
    const open = async () => {
      await row(page, 'al').getByRole('button').first().click();
      await expect(dialog(page)).toBeVisible();
    };
    await open();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(page).not.toHaveURL(/booking=/);
    await open();
    await dialog(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page).not.toHaveURL(/booking=/);
    if (info.project.name === 'backoffice-desktop') {
      await open();
      await page.mouse.click(10, 400); // fond, à gauche du panneau latéral
      await expect(dialog(page)).toBeHidden();
      await expect(page).not.toHaveURL(/booking=/);
    }
  });

  test("A14 défilement tactile n'ouvre pas la fiche", async ({ page }, info) => {
    test.skip(info.project.name !== 'backoffice-mobile', 'geste tactile : projet mobile');
    await gotoList(page);
    const box = await rowsVisible(page).first().boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = Math.round(box!.x + box!.width / 2);
    const y = Math.min(Math.round(box!.y + box!.height / 2), 650); // dans la fenêtre (812 px)
    const touch = (type: string, dy = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y - dy }] });
    await touch('touchStart');
    for (let dy = 20; dy <= 300; dy += 20) await touch('touchMove', dy);
    await touch('touchEnd');
    await expect.poll(() => page.evaluate(() => document.querySelector('main')!.scrollTop)).toBeGreaterThan(0); // le geste a bien fait défiler
    await expect(page).not.toHaveURL(/booking=/);
    await expect(dialog(page)).toBeHidden();
  });

  test('temps réel : la fiche ouverte suit une modification en base', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.al}`);
    await expect(dialog(page)).toContainText('Aucune instruction');
    await updateBooking(ids.al, { instructions: 'Changé ailleurs' });
    await expect.poll(() => dialog(page).innerText(), { timeout: 15_000 }).toContain('Changé ailleurs');
  });

  test('hors ligne : liste et fiche en cache lisibles', async ({ page, context }) => {
    await gotoList(page);
    await row(page, 'al').getByRole('button').first().click();
    await expect(dialog(page)).toContainText('e2e-bk-al');
    await dialog(page).getByRole('button', { name: 'Fermer' }).click();
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toBeVisible();
    await expect(row(page, 'al')).toBeVisible();
    await row(page, 'al').getByRole('button').first().click();
    await expect(dialog(page)).toContainText('e2e-bk-al');
    await context.setOffline(false);
  });
});

test.describe('chauffeur', () => {
  test.use({ ...asDriver, timezoneId: 'America/Los_Angeles' });

  test('A1 driver ne voit que ses courses', async ({ page }) => {
    await gotoList(page);
    await expect(page.getByRole('heading', { name: 'Mes courses', level: 1 })).toBeVisible();
    await expect(row(page, 'cf1')).toBeVisible();
    await expect(row(page, 'cf2')).toBeVisible();
    await expect(row(page, 'late')).toHaveCount(0);
    await expect(row(page, 'al')).toHaveCount(0);
    await expect(row(page, 'cf1')).not.toContainText('Conflit'); // conflit : owner/manager seulement
    await page.getByLabel('Recherche').fill('e2e-bk');
    await expect(row(page, 'cf1')).toBeVisible();
    await expect(row(page, 'late')).toHaveCount(0);
  });
});
