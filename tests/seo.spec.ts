import { test, expect } from '@playwright/test';

test.describe('Phase 3 - Optimisations SEO et Lazy Loading', () => {
  test('La balise Open Graph og:title doit être présente', async ({ page }) => {
    // Naviguer sur la page des services (ou une autre page rendue)
    await page.goto('/services');
    
    // Vérifier la présence des balises og:title et og:description
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveCount(1);
    
    const ogDesc = page.locator('meta[property="og:description"]');
    await expect(ogDesc).toHaveCount(1);
    
    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveCount(1);
  });

  test('Les grandes images doivent avoir le loading="lazy"', async ({ page }) => {
    await page.goto('/services');
    
    // Vérifier la présence de l'image de la section hero de Paris (Unsplash)
    const image = page.locator('img[src*="1549413247"]');
    
    // L'image doit exister
    await expect(image).toHaveCount(1);
    
    // L'attribut loading="lazy" doit être présent
    await expect(image).toHaveAttribute('loading', 'lazy');
  });
});
