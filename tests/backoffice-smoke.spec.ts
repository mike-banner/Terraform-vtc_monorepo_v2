import { test, expect } from './fixtures/auth';
import { asOwner, asDriver } from './fixtures/auth';
import { collectConsoleErrors, expectNoHorizontalScroll, expectNoAppBlankScreen } from './helpers/page-checks';

const OWNER_PAGES = ['dashboard', 'bookings', 'vehicles', 'pricing', 'ledger', 'settings', 'profile'];
const DRIVER_PAGES = ['dashboard', 'bookings', 'profile'];

for (const [role, state, pages] of [
  ['owner', asOwner, OWNER_PAGES],
  ['driver', asDriver, DRIVER_PAGES],
] as const) {
  test.describe(`fumée ${role}`, () => {
    test.use(state);
    for (const name of pages) {
      test(`/app/${name}`, async ({ page }) => {
        const errors = collectConsoleErrors(page);
        const res = await page.goto(`/app/${name}`);
        expect(res?.status()).toBeLessThan(400);
        expect(page.url()).toContain(`/app/${name}`);
        await expectNoAppBlankScreen(page);
        await expectNoHorizontalScroll(page);
        expect(errors()).toEqual([]);
      });
    }
  });
}
