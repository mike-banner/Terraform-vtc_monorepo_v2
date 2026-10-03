import { test as base } from '@playwright/test';

export const asOwner = { storageState: 'tests/.auth/owner.json' };
export const asDriver = { storageState: 'tests/.auth/driver.json' };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// Utiliser `test.use(asOwner)` / `test.use(asDriver)` dans un describe.
// Le dashboard appelle l'Edge Function Stripe locale, qui parle à la vraie API Stripe (clé de test) et crée un compte Connect
// à chaque base neuve : simulée pour tous les tests. Un test peut la re-simuler (la dernière route déclarée gagne).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/functions/v1/create-stripe-onboarding', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ type: 'dashboard', url: 'https://stripe.test/d' }) }),
    );
    await use(page);
  },
});
export { expect } from '@playwright/test';
