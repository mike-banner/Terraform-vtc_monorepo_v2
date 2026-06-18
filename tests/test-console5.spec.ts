import { test, expect } from '@playwright/test';
test('check form submission error', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:4321/tunnels/transfert', { waitUntil: 'networkidle' });
  
  await page.locator('select[name="routeSelect"]').selectOption({ index: 1 });
  await page.locator('input[name="pickupAddress"]').fill('1 Rue de Rivoli, 75001 Paris, Terminal 2E, Vol AF123');
  await page.locator('input[name="dropoffAddress"]').fill('1 Rue de Rivoli, 75001 Paris');
  
  // Intercept submit
  await page.evaluate(() => {
    document.getElementById('tunnel-form').addEventListener('submit', () => {
      console.log('FORM SUBMIT EVENT FIRED!');
    });
  });
  
  await page.locator('button:has-text("Continuer")').click();
  
  await page.waitForTimeout(2000);
});
