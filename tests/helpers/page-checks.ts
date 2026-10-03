import { expect, type Page } from '@playwright/test';

/** Erreurs console et exceptions de page ; appeler avant goto, lire la liste après. */
export function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return () => errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'défilement horizontal').toBeLessThanOrEqual(0);
}

/** Chaque élément visible du sélecteur fait au moins 44×44 px. */
export async function expectTouchTargets(page: Page, selector: string) {
  const els = page.locator(selector);
  for (let i = 0; i < (await els.count()); i++) {
    const el = els.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44, `cible tactile ${selector}[${i}] ${JSON.stringify(box)}`).toBe(true);
  }
}

export async function expectNoAppBlankScreen(page: Page) {
  await expect(async () => {
    const text = (await page.locator('main').first().innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
  }).toPass({ timeout: 3000 });
}
