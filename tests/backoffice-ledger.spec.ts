import { readFileSync } from 'node:fs';
import { test, expect, asOwner, asDriver } from './fixtures/auth';
import { expectNoHorizontalScroll } from './helpers/page-checks';
import { resetLedgerMovements, seedLedgerMovement, setTenantSiret } from './helpers/seed';

const BOOKING = '77777777-7777-7777-7777-777777777772';
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const year = new Date().getFullYear();

test.describe('grand livre', () => {
  test.use(asOwner);
  test.beforeEach(async () => {
    resetLedgerMovements();
    await seedLedgerMovement('refund', `${year}-03-15T10:00:00Z`, 30, 27.27, 2.73);
  });
  test.afterAll(() => resetLedgerMovements());

  test('grille de 12 mois, mois futurs non cliquables', async ({ page }) => {
    await page.goto('/app/ledger');
    await expect(page.locator('[data-month]')).toHaveCount(12);
    const now = new Date().getMonth() + 1;
    for (let m = 1; m <= 12; m++) {
      const b = page.locator(`[data-month="${m}"]`);
      if (m <= now) await expect(b).toBeEnabled();
      else await expect(b).toBeDisabled();
    }
  });

  test('KPI annuels = réponse de tenant_ledger_year', async ({ page }) => {
    const res = page.waitForResponse((r) => r.url().includes('rpc/tenant_ledger_year'));
    await page.goto('/app/ledger');
    const { totals } = await (await res).json();
    const kpi = page.getByTestId('ledger-totals');
    await expect(kpi).toContainText(eur(totals.gross));
    await expect(kpi).toContainText(eur(totals.net));
    await expect(kpi).toContainText(eur(totals.vat));
  });

  test('détail du mois : remboursement négatif, totaux du serveur, mode dans l\'URL', async ({ page }) => {
    const res = page.waitForResponse((r) => r.url().includes('rpc/tenant_ledger_month'));
    await page.goto(`/app/ledger?year=${year}&month=3`);
    const { totals, movements } = await (await res).json();
    expect(movements.some((m: { signed_gross: number }) => m.signed_gross === -30)).toBe(true);
    const row = page.locator('[data-row]:visible', { hasText: 'Remboursement' });
    await expect(row).toContainText(/-30,00\s€/);
    await expect(page.getByTestId('ledger-totals')).toContainText(eur(totals.gross));
    await page.getByRole('button', { name: 'Espèces' }).click();
    await expect(page).toHaveURL(/mode=cash/);
    await expect(page.getByText('Aucune transaction ce mois-ci.')).toBeVisible();
  });

  test('clic sur une ligne : fiche puis lien vers la course', async ({ page }) => {
    await page.goto(`/app/ledger?year=${year}&month=3`);
    await page.locator('[data-row]:visible', { hasText: 'Remboursement' }).getByRole('button').first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Remboursement' })).toBeVisible();
    await expect(sheet).toContainText(/-30,00\s€/);
    await sheet.getByRole('link', { name: 'Ouvrir la course' }).click();
    await page.waitForURL(`**/app/bookings?booking=${BOOKING}`);
  });

  test('exports FEC et CSV annuels, CSV du mois signé', async ({ page }) => {
    const previous = await setTenantSiret('12345678901234'); // le FEC exige un SIRET
    test.info().annotations.push({ type: 'siret', description: 'restauré en fin de test' });
    try {
      await exportsScenario(page);
    } finally {
      await setTenantSiret(previous);
    }
  });

  test('FEC sans SIRET : message métier', async ({ page }) => {
    const previous = await setTenantSiret(null);
    try {
      await page.goto('/app/ledger');
      await page.getByRole('button', { name: 'FEC annuel' }).click();
      await expect(page.getByText(/SIRET manquant/)).toBeVisible();
    } finally {
      await setTenantSiret(previous);
    }
  });

  async function exportsScenario(page: import('@playwright/test').Page) {
    await page.goto('/app/ledger');
    for (const name of ['FEC annuel', 'CSV annuel']) {
      const dl = page.waitForEvent('download');
      await page.getByRole('button', { name }).click();
      expect((await dl).suggestedFilename()).toMatch(/\.(txt|csv)$/);
    }
    await page.goto(`/app/ledger?year=${year}&month=3`);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter CSV' }).click();
    const file = await (await dl).path();
    expect(readFileSync(file!, 'utf8')).toContain('Remboursement;');
    expect(readFileSync(file!, 'utf8')).toContain('-27,27;-2,73');
  }

  test('pas de défilement horizontal, grille et détail', async ({ page }) => {
    await page.goto('/app/ledger');
    await expect(page.locator('[data-month]')).toHaveCount(12);
    await expectNoHorizontalScroll(page);
    await page.goto(`/app/ledger?year=${year}&month=3`);
    await expect(page.locator('[data-row]:visible').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('grand livre : chauffeur', () => {
  test.use(asDriver);
  test('redirigé hors de /app/ledger', async ({ page }) => {
    await page.goto('/app/ledger');
    expect(page.url()).not.toMatch(/\/app\/ledger(\?|$)/);
  });
});
