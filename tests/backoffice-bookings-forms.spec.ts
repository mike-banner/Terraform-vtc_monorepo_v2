import type { Page, Route } from '@playwright/test';
import { test, expect, asOwner, asDriver } from './fixtures/auth';
import { cleanupByPrefix, firstVehicleId, seedBooking } from './helpers/seed';

// Création et édition de course (annexe A12, A13, A14). Le prix affiché vient de la RPC quote_booking_estimate ;
// plusieurs tests interceptent la réponse pour prouver que le navigateur n'affiche que la valeur du serveur.
const TAG = 'bf';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const ids: Record<string, string> = {};
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) + 'T10:00';
const slot = (n: number) => {
  const d = new Date(Date.now() + (120 + n) * 86_400_000);
  d.setUTCHours(11, 0, 0, 0);
  return d.toISOString();
};
const newSheet = (page: Page) => page.getByRole('dialog', { name: 'Nouvelle course' });
const editSheet = (page: Page) => page.getByRole('dialog', { name: 'Modifier la course' });
const detail = (page: Page) => page.getByRole('dialog', { name: /^Course #/ });

/** Intercepte un appel REST : enregistre le corps ; `reply` répond, sinon l'appel passe à la base locale. */
async function intercept(page: Page, url: string, reply?: (n: number) => unknown) {
  const bodies: any[] = [];
  await page.route(url, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply ? route.fulfill({ status: 204, headers: CORS }) : route.continue();
    bodies.push(req.postDataJSON());
    if (!reply) return route.continue();
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(reply(bodies.length)) });
  });
  return bodies;
}
const quoteUrl = '**/rest/v1/rpc/quote_booking_estimate';
const createUrl = '**/rest/v1/rpc/create_manual_booking';
const updateUrl = '**/rest/v1/rpc/update_booking_details';

async function fillBase(page: Page, n: number, extra: { dropoff?: boolean } = { dropoff: true }) {
  const s = newSheet(page);
  await s.getByLabel('Nom du client').fill(`E2E e2e-${TAG}-${n}`);
  await s.getByLabel('E-mail du client').fill(`e2e-${TAG}-${n}@local.test`);
  await s.getByLabel('Adresse de départ').fill('1 rue de la République, Lyon');
  if (extra.dropoff) await s.getByLabel("Adresse d'arrivée").fill('Aéroport Saint-Exupéry');
  await s.getByLabel('Date et heure de prise en charge').fill(future(100 + n));
}
async function openNew(page: Page) {
  await page.goto('/app/bookings');
  await page.getByRole('button', { name: 'Nouvelle course' }).click();
  await expect(newSheet(page)).toBeVisible();
  await expect(newSheet(page).getByLabel('Véhicule')).not.toHaveValue(''); // véhicule actif présélectionné
}

const nativeDialogs: string[] = [];
test.beforeEach(({ page }) => {
  nativeDialogs.length = 0;
  page.on('dialog', (d) => {
    nativeDialogs.push(`${d.type()}: ${d.message()}`);
    void d.dismiss();
  });
});
test.afterEach(() => expect(nativeDialogs, 'fenêtre native').toEqual([]));

test.beforeAll(async () => {
  cleanupByPrefix(TAG);
  const vehicle_id = await firstVehicleId();
  const cur = { status: 'accepted', mission_status: 'not_started', vehicle_id };
  ids.ed = (await seedBooking({ tag: `${TAG}-ed`, ...cur, pickup_time: slot(1) })).id;
  ids.ed2 = (await seedBooking({ tag: `${TAG}-ed2`, ...cur, pickup_time: slot(2) })).id;
  ids.edh = (await seedBooking({ tag: `${TAG}-edh`, ...cur, booking_type: 'hourly', duration_hours: 2, pickup_time: slot(3) })).id;
  ids.q = (await seedBooking({ tag: `${TAG}-q`, ...cur, status: 'pending', mission_status: 'to_validate', booking_source: 'customer', pickup_time: slot(4) })).id;
});
test.afterAll(() => cleanupByPrefix(TAG));

test.describe('formulaires (owner)', () => {
  test.use({ ...asOwner });

  test('A12 nouvelle course transfert', async ({ page }) => {
    await openNew(page);
    await fillBase(page, 1);
    await newSheet(page).getByLabel('Montant TTC (€)').fill('55');
    await newSheet(page).getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(page).toHaveURL(/booking=/);
    await expect(detail(page)).toContainText(`e2e-${TAG}-1`);
    await expect(detail(page)).toContainText('Transfert');
    await expect(detail(page)).toContainText(/55,00\s€/);
  });

  test('A12 mise à disposition en heures', async ({ page }) => {
    await openNew(page);
    const s = newSheet(page);
    await s.getByLabel('Type de course').selectOption('hourly');
    await expect(s.getByLabel("Adresse d'arrivée")).toHaveCount(0);
    await fillBase(page, 2, { dropoff: false });
    const quote = page.waitForResponse((r) => r.url().includes('quote_booking_estimate') && r.request().postDataJSON().p_duration_hours === 3);
    await s.getByLabel('Durée (heures)').fill('3');
    const price = Number(await (await quote).json());
    await expect(s).toContainText(`Prix estimé : ${price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue(price.toFixed(2));
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(detail(page)).toContainText(`e2e-${TAG}-2`);
    await expect(detail(page)).toContainText('Mise à disposition, 3 h');
  });

  test('A12 mise à disposition au kilomètre : durée masquée, distance exigée', async ({ page }) => {
    await openNew(page);
    const s = newSheet(page);
    await s.getByLabel('Type de course').selectOption('hourly');
    await s.getByLabel('Facturation').selectOption('km');
    await expect(s.getByLabel('Durée (heures)')).toHaveCount(0);
    await fillBase(page, 3, { dropoff: false });
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(s).toContainText('Indiquez une distance supérieure à 0.');
    const quote = page.waitForRequest((r) => r.url().includes('quote_booking_estimate'));
    await s.getByLabel('Distance (km)').fill('20');
    expect((await quote).postDataJSON()).toMatchObject({ p_booking_type: 'transfer', p_distance_km: 20 });
  });

  test('A12 forfait fixe pré-remplit zones et prix', async ({ page }) => {
    await openNew(page);
    const s = newSheet(page);
    const quote = page.waitForResponse((r) => r.url().includes('quote_booking_estimate') && !!r.request().postDataJSON().p_fixed_route_id);
    await s.getByLabel('Forfait').selectOption({ label: 'Lyon centre → Aéroport Saint-Exupéry' });
    await expect(s.getByLabel('Adresse de départ')).toHaveValue('Lyon centre - ');
    await expect(s.getByLabel("Adresse d'arrivée")).toHaveValue('Aéroport Saint-Exupéry - ');
    const price = Number(await (await quote).json());
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue(price.toFixed(2));
    expect(price).toBeGreaterThan(0);
  });

  test('A12 aperçu de prix venant du serveur', async ({ page }) => {
    await intercept(page, quoteUrl, () => 123.45);
    await openNew(page);
    const s = newSheet(page);
    const req = page.waitForRequest((r) => r.url().includes('rpc/quote_booking_estimate'));
    await s.getByLabel('Forfait').selectOption({ index: 1 });
    const body = (await req).postDataJSON();
    expect(body.p_vehicle_id).toBeTruthy();
    expect(body.p_fixed_route_id).toBeTruthy();
    await expect(s).toContainText(/Prix estimé : 123,45\s€ \(aperçu non contractuel\)/);
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('123.45');
  });

  test('A12 le montant saisi n’est pas écrasé par une nouvelle estimation', async ({ page }) => {
    await intercept(page, quoteUrl, () => 80);
    await openNew(page);
    const s = newSheet(page);
    await s.getByLabel('Forfait').selectOption({ index: 1 });
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('80.00');
    await s.getByLabel('Montant TTC (€)').fill('95');
    await s.getByLabel('Passagers').fill('2'); // sans effet sur le prix
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('95');
  });

  test('A12 réinitialisation au changement de type', async ({ page }) => {
    await intercept(page, quoteUrl, () => 80);
    await openNew(page);
    const s = newSheet(page);
    await s.getByLabel('Forfait').selectOption({ index: 1 });
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('80.00');
    await s.getByLabel("Adresse d'arrivée").fill('Autre adresse');
    await s.getByLabel('Type de course').selectOption('hourly');
    await expect(s.getByLabel('Adresse de départ')).toHaveValue('');
    await expect(s.getByLabel(/Adresse de fin/)).toHaveValue('');
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('');
    await expect(s.getByLabel('Durée (heures)')).toHaveValue('1');
    await s.getByLabel('Type de course').selectOption('transfer');
    await expect(s.getByLabel('Forfait')).toHaveValue('');
  });

  test('A12 libellé Carte (sur place)', async ({ page }) => {
    const created = await intercept(page, createUrl, () => [{ booking_id: ids.ed, total_price: 70 }]);
    await openNew(page);
    const s = newSheet(page);
    await expect(s.getByLabel('Paiement').getByRole('option')).toHaveText(['Espèces', 'Carte (sur place)']);
    await s.getByLabel('Paiement').selectOption({ label: 'Carte (sur place)' });
    await fillBase(page, 5);
    await s.getByLabel('Montant TTC (€)').fill('70');
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(page).toHaveURL(new RegExp(`booking=${ids.ed}`));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ p_payment_mode: 'card', p_booking_type: 'transfer', p_manual_total: 70 });
    expect(JSON.stringify(created[0])).not.toMatch(/stripe|payment_link/i); // D-08 : aucun lien de paiement
  });

  test('A12 validation : champs obligatoires et date passée, messages en français', async ({ page }) => {
    const created = await intercept(page, createUrl, () => [{ booking_id: ids.ed, total_price: 1 }]);
    await openNew(page);
    const s = newSheet(page);
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(s).toContainText('Le nom du client est obligatoire.');
    await expect(s).toContainText('Adresse e-mail invalide.');
    await expect(s).toContainText("L'adresse de départ est obligatoire.");
    await s.getByLabel('Date et heure de prise en charge').fill('2020-01-01T10:00');
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(s).toContainText('La date doit être dans le futur.');
    expect(created).toHaveLength(0);
  });

  test('A12 plafond du montant', async ({ page }) => {
    await openNew(page);
    const s = newSheet(page);
    await fillBase(page, 6);
    await s.getByLabel('Montant TTC (€)').fill('100000');
    await s.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await expect(s).toContainText(/ne peut pas dépasser 99\s999\s€/);
  });

  test('A13 édition date et adresses', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.ed}`);
    await detail(page).getByRole('button', { name: 'Modifier', exact: true }).click();
    const s = editSheet(page);
    await expect(s).toBeVisible();
    await expect(s.getByLabel('Adresse de départ')).toHaveValue('Départ e2e');
    await s.getByLabel('Adresse de départ').fill('12 quai Perrache, Lyon');
    await s.getByLabel("Adresse d'arrivée").fill('Part-Dieu');
    await s.getByLabel('Date et heure de prise en charge').fill(future(130));
    await s.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(s).toBeHidden();
    await expect(detail(page)).toContainText('12 quai Perrache, Lyon');
    await expect(detail(page)).toContainText('Part-Dieu');
  });

  test("A13 manual_total non envoyé s'il n'a pas changé", async ({ page }) => {
    const calls = await intercept(page, updateUrl, () => 100);
    await page.goto(`/app/bookings?booking=${ids.ed2}`);
    await detail(page).getByRole('button', { name: 'Modifier', exact: true }).click();
    const s = editSheet(page);
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('100.00');
    await s.getByLabel('Adresse de départ').fill('Nouvelle adresse');
    await s.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(s).toBeHidden();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toHaveProperty('p_manual_total');
    expect(calls[0]).toMatchObject({ p_booking_id: ids.ed2, p_pickup_address: 'Nouvelle adresse' });

    await detail(page).getByRole('button', { name: 'Modifier', exact: true }).click();
    await s.getByLabel('Montant TTC (€)').fill('120');
    await s.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(s).toBeHidden();
    expect(calls[1]).toMatchObject({ p_manual_total: 120 });
  });

  test('A13 durée : nouveau montant proposé par le serveur, corrigeable', async ({ page }) => {
    await intercept(page, quoteUrl, () => 77);
    const calls = await intercept(page, updateUrl, () => 77);
    await page.goto(`/app/bookings?booking=${ids.edh}`);
    await detail(page).getByRole('button', { name: 'Modifier', exact: true }).click();
    const s = editSheet(page);
    await expect(s.getByLabel('Durée (heures)')).toHaveValue('2');
    await s.getByLabel('Durée (heures)').fill('4');
    await expect(s.getByLabel('Montant TTC (€)')).toHaveValue('77.00');
    await expect(s).toContainText(/Montant proposé par le serveur : 77,00\s€/);
    await s.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(s).toBeHidden();
    expect(calls[0]).toMatchObject({ p_duration_hours: 4, p_manual_total: 77 });
  });

  test('A6 « Fixer le prix » ouvre l’édition', async ({ page }) => {
    await page.goto(`/app/bookings?booking=${ids.q}`);
    await detail(page).getByRole('button', { name: 'Fixer le prix' }).click();
    await expect(editSheet(page)).toBeVisible();
  });

  test('A14 formulaire plein écran à 375 px et bouton Fermer visible', async ({ page }, info) => {
    await openNew(page);
    const s = newSheet(page);
    const close = s.getByRole('button', { name: 'Fermer' });
    await expect(close).toBeVisible();
    const box = (await s.boundingBox())!;
    if (info.project.name === 'backoffice-mobile') {
      expect(box.width).toBeGreaterThanOrEqual(375);
      expect(box.height).toBeGreaterThanOrEqual(800);
      expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    } else {
      expect(box.width).toBeLessThanOrEqual(600);
    }
    await page.keyboard.press('Escape');
    await expect(s).toBeHidden();
    await page.getByRole('button', { name: 'Nouvelle course' }).click();
    await close.click();
    await expect(s).toBeHidden();
  });

  test('A12 hors ligne : le bouton Nouvelle course est désactivé', async ({ page, context }) => {
    await page.goto('/app/bookings');
    await expect(page.getByRole('button', { name: 'Nouvelle course' })).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Nouvelle course' })).toBeDisabled({ timeout: 15_000 });
    await context.setOffline(false);
  });
});

test.describe('formulaires (driver)', () => {
  test.use({ ...asDriver });
  test('A12 pas de bouton Nouvelle course pour un chauffeur', async ({ page }) => {
    await page.goto('/app/bookings');
    await expect(page.getByRole('heading', { name: 'Mes courses' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle course' })).toHaveCount(0);
  });
});
