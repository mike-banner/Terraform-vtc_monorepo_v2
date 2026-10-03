import type { Page, Route } from '@playwright/test';
import { test, expect, asOwner, asDriver } from './fixtures/auth';
import { cleanupByPrefix, seedBooking } from './helpers/seed';

// Actions de la fiche (annexe A3, A4, A6 à A10). Les écritures qui touchent au ledger (course payée, terminée,
// remboursement) sont interceptées : le corps envoyé est vérifié, la base n'est pas modifiée.
const DRIVER_ID = '55555555-5555-5555-5555-555555555555';
const TAG = 'ba';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

test.use({ ...asOwner });

const ids: Record<string, string> = {};
// Un créneau par course (le conflit de créneau se calcule sur toute la base) : jour +60+n à 10:00 UTC.
const slot = (n: number) => {
  const d = new Date(Date.now() + (60 + n) * 86_400_000);
  d.setUTCHours(10, 0, 0, 0);
  return d.toISOString();
};
const dialog = (page: Page) => page.getByRole('dialog').first();
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

type Call = { body: any };
/** Intercepte un appel (RPC ou fonction) : enregistre le corps ; `reply` répond, sinon l'appel passe à la base locale. */
async function intercept(page: Page, url: string, reply?: (call: Call, n: number) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  await page.route(url, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply ? route.fulfill({ status: 204, headers: CORS }) : route.continue();
    const call = { body: req.postDataJSON() };
    calls.push(call);
    if (!reply) return route.continue();
    const r = reply(call, calls.length);
    return route.fulfill({ status: r.status ?? 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(r.json) });
  });
  return calls;
}
const rpcUrl = (name: string) => `**/rest/v1/rpc/${name}`;
const fnUrl = (name: string) => `**/functions/v1/${name}`;

async function open(page: Page, key: string) {
  await page.goto(`/app/bookings?booking=${ids[key]}`);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(`e2e-${TAG}-${key}`);
}

// Enregistre les ouvertures de fenêtre (PDF) sans ouvrir d'onglet.
const trackOpen = (page: Page) =>
  page.addInitScript(() => {
    (window as any).__opened = [];
    window.open = (...a: any[]) => ((window as any).__opened.push(a), null);
  });
const opened = (page: Page) => page.evaluate(() => (window as any).__opened as unknown[][]);

const nativeDialogs: string[] = [];
test.beforeEach(({ page }) => {
  nativeDialogs.length = 0;
  page.on("dialog", (d) => {
    nativeDialogs.push(`${d.type()}: ${d.message()}`);
    void d.dismiss();
  });
});
test.afterEach(() => expect(nativeDialogs, 'fenêtre native (alert, confirm, prompt)').toEqual([]));

test.beforeAll(async () => {
  cleanupByPrefix(TAG);
  const cur = { status: 'accepted', mission_status: 'not_started' };
  const mk = async (key: string, o: Record<string, unknown> = {}) => {
    ids[key] = (await seedBooking({ tag: `${TAG}-${key}`, ...cur, ...o })).id;
  };
  const quote = { status: 'pending', mission_status: 'to_validate', booking_source: 'customer' };
  await mk('instr', { pickup_time: slot(1), instructions: 'Sonner deux fois' });
  await mk('al', { pickup_time: slot(2), address_alert: 'hors_zone_depart' });
  await mk('q', { ...quote, pickup_time: slot(3) });
  await mk('qc', { ...quote, pickup_time: slot(4) });
  await mk('qo', { pickup_time: slot(4) }); // même créneau que qc : conflit connu à l'ouverture
  await mk('qd', { ...quote, pickup_time: slot(5) });
  await mk('paid', { status: 'paid', mission_status: 'to_validate', payment_mode: 'card', driver_id: DRIVER_ID, pickup_time: slot(6) });
  await mk('route', { pickup_time: new Date(Date.now() + 5 * 60_000).toISOString() });
  await mk('long', { mission_status: 'in_progress', pickup_time: ago(7), mission_note: `[terrain] en_route_at=${ago(6)}` });
  await mk('cx', { pickup_time: slot(7) });
  await mk('cx2', { pickup_time: slot(8) });
  await mk('ns', { pickup_time: ago(1) });
  await mk('rf', { status: 'refund_failed', pickup_time: slot(9) });
  await mk('inv', { mission_status: 'completed', pickup_time: ago(30) });
  await mk('av', { mission_status: 'completed', pickup_time: ago(31), invoice_number: 'FAC-2026-E2EA' });
});

test.afterAll(() => cleanupByPrefix(TAG));

test.describe('actions (owner)', () => {
  test("A3 modifier les instructions", async ({ page }) => {
    await open(page, 'instr');
    await dialog(page).getByRole('button', { name: 'Modifier les instructions' }).click();
    await dialog(page).getByRole('textbox', { name: 'Instructions' }).fill('Hall B, pancarte au nom du client');
    await dialog(page).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog(page).getByRole('button', { name: 'Modifier les instructions' })).toBeVisible();
    await expect(dialog(page)).toContainText('Hall B, pancarte au nom du client');
    await page.reload();
    await expect(dialog(page)).toContainText('Hall B, pancarte au nom du client');
  });

  test("A4 marquer l'adresse vérifiée", async ({ page }) => {
    await open(page, 'al');
    await expect(dialog(page)).toContainText('hors de la zone');
    await dialog(page).getByRole('button', { name: 'Marquer comme vérifiée' }).click();
    await expect(dialog(page).getByRole('note', { name: "Alerte d'adresse" })).toContainText('Adresse vérifiée');
    await expect(dialog(page).getByRole('button', { name: 'Marquer comme vérifiée' })).toHaveCount(0);
  });

  test("A6 envoyer le devis", async ({ page }) => {
    await trackOpen(page);
    const calls = await intercept(page, fnUrl('generate-devis'), () => ({ json: { invoice_url: 'http://localhost:4329/devis.pdf' } }));
    await open(page, 'q');
    await dialog(page).getByRole('button', { name: 'Envoyer le devis' }).click();
    await expect.poll(async () => (await opened(page)).length).toBe(1);
    expect(calls[0].body).toEqual({ booking_id: ids.q });
    expect((await opened(page))[0]).toEqual(['http://localhost:4329/devis.pdf', '_blank', 'noopener']);
  });

  test("A6 accepter avec conflit : deux confirmations", async ({ page }) => {
    // Conflit connu : une confirmation, puis l'appel part directement avec p_force.
    const known = await intercept(page, rpcUrl('accept_quote_manually'), () => ({ json: 'ok' }));
    await open(page, 'qc');
    await expect(dialog(page).getByRole('alert', { name: 'Conflit de créneau' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Devis accepté' }).click();
    const box = page.getByRole('dialog', { name: 'Conflit de créneau' });
    await expect(box).toContainText('Valider quand même ?');
    await box.getByRole('button', { name: 'Valider quand même' }).click();
    await expect.poll(() => known.length).toBe(1);
    expect(known[0].body).toEqual({ p_booking_id: ids.qc, p_force: true });

    // Conflit découvert par le serveur : seconde confirmation, puis rappel avec p_force.
    await page.unroute(rpcUrl('accept_quote_manually'));
    const server = await intercept(page, rpcUrl('accept_quote_manually'), (_c, n) =>
      n === 1 ? { status: 400, json: { code: 'P0001', message: 'Conflit de créneau avec une autre course', details: null, hint: null } } : { json: 'ok' });
    await open(page, 'q');
    await dialog(page).getByRole('button', { name: 'Devis accepté' }).click();
    const second = page.getByRole('dialog', { name: 'Valider quand même ?' });
    await expect(second).toContainText('Conflit de créneau avec une autre course');
    await second.getByRole('button', { name: 'Valider quand même' }).click();
    await expect.poll(() => server.length).toBe(2);
    expect(server[0].body).toEqual({ p_booking_id: ids.q });
    expect(server[1].body).toEqual({ p_booking_id: ids.q, p_force: true });
  });

  test("A6 refuser : motif obligatoire", async ({ page }) => {
    const calls = await intercept(page, rpcUrl('decline_booking_request'), () => ({ json: 'ok' }));
    await open(page, 'qd');
    await dialog(page).getByRole('button', { name: 'Refuser la demande' }).click();
    const box = page.getByRole('dialog', { name: 'Motif du refus' });
    await box.getByRole('button', { name: 'OK' }).click();
    await expect(box).toContainText('Ce champ est obligatoire.');
    expect(calls).toHaveLength(0);
    await box.getByLabel('Motif du refus (obligatoire)').fill('Créneau indisponible');
    await box.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ p_booking_id: ids.qd, p_reason: 'Créneau indisponible' });
  });

  test("A7 sans profil chauffeur : bouton désactivé", async ({ page }) => {
    // Le compte owner du seed a une fiche chauffeur : la lecture de `drivers` est vidée pour simuler son absence.
    await intercept(page, '**/rest/v1/drivers*', () => ({ json: [] }));
    await open(page, 'paid');
    await expect(dialog(page).getByRole('button', { name: 'Accepter la course' })).toBeDisabled();
    await expect(dialog(page)).toContainText('Profil chauffeur requis');
  });

  test("A8 en route puis terminer", async ({ page }) => {
    const calls = await intercept(page, rpcUrl("terrain_transition"), undefined);
    await open(page, 'route');
    await dialog(page).getByRole('button', { name: 'En route' }).click();
    await expect(dialog(page).getByRole('button', { name: 'Terminer' })).toBeVisible();
    expect(calls[0].body).toMatchObject({ p_booking_id: ids.route, p_action: 'en_route' });
    // « Terminer » écrirait au ledger (cash) : interceptée.
    await page.unroute(rpcUrl('terrain_transition'));
    const end = await intercept(page, rpcUrl('terrain_transition'), () => ({ json: 'note' }));
    await dialog(page).getByRole('button', { name: 'Terminer' }).click();
    await expect.poll(() => end.length).toBe(1);
    expect(end[0].body).toMatchObject({ p_booking_id: ids.route, p_action: 'completed' });
    expect(end[0].body.p_corrected_at ?? null).toBeNull();
  });

  test("A8 correction de l'horodatage bornée", async ({ page }) => {
    const calls = await intercept(page, rpcUrl('terrain_transition'), () => ({ json: 'note' }));
    await open(page, 'long');
    await dialog(page).getByRole('button', { name: 'Terminer' }).click();
    const sheet = page.getByRole('dialog', { name: 'Fin de course' });
    const field = sheet.getByLabel('Heure réelle de fin');
    const [min, max] = [await field.getAttribute('min'), await field.getAttribute('max')];
    expect(min && max && min < max, `bornes ${min} .. ${max}`).toBeTruthy();
    await sheet.getByRole('button', { name: "Confirmer l'heure corrigée" }).click();
    await expect.poll(() => calls.length).toBe(1);
    const at = new Date(calls[0].body.p_corrected_at).getTime();
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(at).toBeGreaterThan(Date.now() - 6.5 * 3_600_000);
  });

  test("A9 annulation : 4 cas et montant serveur", async ({ page }) => {
    const rows = (amount: number) => [
      { case_code: 'client', rate: 1, amount, paid: true },
      { case_code: 'no_show', rate: null, amount: null, paid: true },
      { case_code: 'driver_fault', rate: 1, amount, paid: true },
      { case_code: 'other', rate: null, amount: null, paid: true },
    ];
    const previews = await intercept(page, rpcUrl('cancellation_preview'), (c) => ({ json: rows(c.body.p_rate === undefined ? 12.34 : 77.7) }));
    const cancels = await intercept(page, fnUrl('cancel-booking'), () => ({ json: { refund_status: 'pending' } }));
    await open(page, 'cx');
    await dialog(page).getByRole('button', { name: 'Annuler la course' }).click();
    await expect(dialog(page).getByRole('option')).toHaveCount(4);
    // 12,34 vient du serveur : la course vaut 100 €.
    await expect(dialog(page)).toContainText(/Montant remboursé : 12,34\s€/);
    await expect(dialog(page).getByLabel(/Taux de remboursement/)).toHaveCount(0);
    await dialog(page).getByLabel("Cas d'annulation").selectOption('other');
    await dialog(page).getByLabel(/Taux de remboursement/).fill('40');
    await expect.poll(() => previews.some((p) => p.body.p_rate === 0.4)).toBe(true);
    await dialog(page).getByLabel('Motif (obligatoire)').fill('Imprévu du client');
    await dialog(page).getByRole('button', { name: "Confirmer l'annulation" }).click();
    await page.getByRole('dialog', { name: 'Annuler la course ?' }).getByRole('button', { name: "Confirmer l'annulation" }).click();
    await expect.poll(() => cancels.length).toBe(1);
    expect(cancels[0].body).toEqual({ booking_id: ids.cx, case: 'other', rate: 0.4, note: 'Imprévu du client' });
    await expect(page.getByText('Remboursement en cours')).toBeVisible();
  });

  test("A9 annulation : motif obligatoire", async ({ page }) => {
    const cancels = await intercept(page, fnUrl('cancel-booking'), () => ({ json: {} }));
    await open(page, 'cx2');
    await dialog(page).getByRole('button', { name: 'Annuler la course' }).click();
    await expect(dialog(page).getByRole('option')).toHaveCount(4);
    const confirmBtn = dialog(page).getByRole('button', { name: "Confirmer l'annulation" });
    await expect(confirmBtn).toBeDisabled();
    await dialog(page).getByLabel('Motif (obligatoire)').fill('   ');
    await expect(confirmBtn).toBeDisabled();
    expect(cancels).toHaveLength(0);
  });

  test("A9 non réalisée", async ({ page }) => {
    const calls = await intercept(page, rpcUrl('mark_booking_no_show'), () => ({ json: 'ok' }));
    await open(page, 'ns');
    await dialog(page).getByRole('button', { name: 'Non réalisée (client absent)' }).click();
    await expect(dialog(page).getByLabel("Cas d'annulation")).toHaveCount(0);
    await dialog(page).getByLabel('Motif (obligatoire)').fill('Client absent au point de rendez-vous');
    await dialog(page).getByRole('button', { name: 'Confirmer : non réalisée' }).click();
    await page.getByRole('dialog', { name: /non réalisée/ }).getByRole('button', { name: 'Confirmer : non réalisée' }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ p_booking_id: ids.ns, p_reason: 'Client absent au point de rendez-vous' });
  });

  test("A9 reprise du remboursement", async ({ page }) => {
    const calls = await intercept(page, fnUrl('cancel-booking'), () => ({ json: { refund_status: 'succeeded' } }));
    await open(page, 'rf');
    await dialog(page).getByRole('button', { name: 'Relancer le remboursement' }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ booking_id: ids.rf, retry: true });
    await expect(page.getByText('Remboursement envoyé')).toBeVisible();
  });

  test("A10 facture sur course terminée seulement", async ({ page }) => {
    await trackOpen(page);
    let n = 0;
    const calls = await intercept(page, fnUrl('generate-invoice'), () => (++n === 1 ? { json: { invoice_url: 'http://localhost:4329/facture.pdf' } } : { json: { already_generated: true } }));
    await open(page, 'instr');
    await expect(dialog(page).getByRole('button', { name: /facture/i })).toHaveCount(0);
    await open(page, 'inv');
    const btn = dialog(page).getByRole('button', { name: 'Générer la facture' });
    await btn.click();
    await expect.poll(async () => (await opened(page)).length).toBe(1);
    expect(calls[0].body).toEqual({ booking_id: ids.inv });
    await btn.click();
    await expect(page.getByText('Facture déjà générée')).toBeVisible();
  });

  test("A10 avoir : reste à créditer et PDF", async ({ page }) => {
    await trackOpen(page);
    await intercept(page, rpcUrl('credit_note_remaining'), () => ({ json: 42.5 }));
    await intercept(page, '**/rest/v1/credit_notes*', () => ({ json: [{ id: 'cn-1', number: 'AV-2026-0001', amount_ttc: 10, issued_at: new Date().toISOString() }] }));
    const fn = await intercept(page, fnUrl('generate-credit-note'), (c) => (c.body.credit_note_id ? { json: { url: 'http://localhost:4329/avoir.pdf' } } : { json: { url: 'http://localhost:4329/avoir2.pdf', message: 'Avoir émis.' } }));
    await open(page, 'av');
    await expect(dialog(page)).toContainText(/Reste à créditer : 42,50\s€/);
    await expect(dialog(page)).toContainText('AV-2026-0001');
    await dialog(page).getByRole('button', { name: "PDF de l'avoir AV-2026-0001" }).click();
    await expect.poll(() => fn.length).toBe(1);
    expect(fn[0].body).toEqual({ credit_note_id: 'cn-1' });
    await dialog(page).getByRole('button', { name: 'Émettre un avoir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Émettre un avoir' });
    await sheet.getByLabel('Montant TTC (€)').fill('50');
    await sheet.getByLabel('Motif').fill('Geste commercial');
    await sheet.getByRole('button', { name: "Émettre l'avoir" }).click();
    await expect(sheet).toContainText('supérieur au reste à créditer');
    expect(fn).toHaveLength(1);
    await sheet.getByLabel('Montant TTC (€)').fill('20,5');
    await sheet.getByRole('button', { name: "Émettre l'avoir" }).click();
    await expect.poll(() => fn.length).toBe(2);
    expect(fn[1].body).toEqual({ booking_id: ids.av, amount: 20.5, reason: 'Geste commercial' });
  });

  test("D-11 hors ligne : actions désactivées avec message", async ({ page, context }) => {
    await open(page, 'instr');
    await context.setOffline(true);
    await expect(dialog(page).getByRole('note').filter({ hasText: 'Hors ligne' })).toBeVisible();
    const btn = dialog(page).getByRole('button', { name: 'Modifier les instructions' });
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('title', /Hors ligne/);
    await expect(dialog(page).getByRole('button', { name: 'Annuler la course' })).toBeDisabled();
    await context.setOffline(false);
    await expect(btn).toBeEnabled();
  });

  test("aucune fenêtre native", async ({ page }) => {
    // Refus sans motif et acceptation avec conflit : boîtes de la page (Dialog), jamais alert, confirm ou prompt.
    await intercept(page, rpcUrl('decline_booking_request'), () => ({ json: 'ok' }));
    await open(page, 'qd');
    await dialog(page).getByRole('button', { name: 'Refuser la demande' }).click();
    await page.getByRole('dialog', { name: 'Motif du refus' }).getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('dialog', { name: 'Motif du refus' })).toContainText('Ce champ est obligatoire.');
    await page.getByRole('dialog', { name: 'Motif du refus' }).getByRole('button', { name: 'Annuler' }).click();
    expect(nativeDialogs).toEqual([]);
  });
});

test.describe('actions (chauffeur)', () => {
  test.use({ ...asDriver });

  test("A7 accepter une course payée", async ({ page }) => {
    const calls = await intercept(page, rpcUrl('accept_paid_booking'), () => ({ json: 'ok' }));
    await open(page, 'paid');
    await dialog(page).getByRole('button', { name: 'Accepter la course' }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ p_booking_id: ids.paid, p_driver_id: DRIVER_ID });
  });
});
