import { test, expect } from '@playwright/test';
test('check visibility', async ({ page }) => {
  await page.goto('http://localhost:4321/tunnels/transfert', { waitUntil: 'networkidle' });
  
  await page.locator('select[name="routeSelect"]').selectOption({ index: 1 });
  
  await page.waitForTimeout(1000);
  
  const isHidden = await page.evaluate(() => {
    return document.getElementById('addressFieldsContainer')?.classList.contains('hidden');
  });
  console.log("Is addressFieldsContainer hidden?", isHidden);
});
