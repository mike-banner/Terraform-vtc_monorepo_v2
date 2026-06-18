import { test, expect } from '@playwright/test';
test('check why step 2 fails', async ({ page }) => {
  page.on('dialog', dialog => {
    console.log("ALERT MESSAGE:", dialog.message());
    dialog.accept();
  });
  await page.goto('http://localhost:4321/tunnels/transfert', { waitUntil: 'networkidle' });
  
  await page.locator('select[name="routeSelect"]').selectOption({ index: 1 });
  await page.locator('input[name="pickupAddress"]').fill('1 Rue de Rivoli, 75001 Paris, Terminal 2E, Vol AF123');
  await page.locator('input[name="dropoffAddress"]').fill('1 Rue de Rivoli, 75001 Paris');
  
  await page.locator('button:has-text("Continuer")').click();
  
  await page.waitForTimeout(2000);
});
