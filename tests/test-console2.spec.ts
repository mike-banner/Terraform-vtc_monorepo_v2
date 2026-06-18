import { test, expect } from '@playwright/test';
test('check console', async ({ page }) => {
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));
  
  await page.goto('http://localhost:4321/tunnels/transfert', { waitUntil: 'networkidle' });
  
  console.log("LOGS ON LOAD:", logs);
  
  await page.locator('select[name="routeSelect"]').selectOption({ index: 1 });
  
  await page.waitForTimeout(1000);
  console.log("LOGS AFTER SELECT:", logs);
});
