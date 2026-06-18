import { test, expect } from '@playwright/test';

test('check console errors', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  await page.goto('http://localhost:4321/tunnels/transfert');
  await page.waitForSelector('form#tunnel-form');
  
  const routeSelect = page.locator('select[name="routeSelect"]');
  await routeSelect.selectOption({ index: 1 });
  
  await page.waitForTimeout(2000);
});
