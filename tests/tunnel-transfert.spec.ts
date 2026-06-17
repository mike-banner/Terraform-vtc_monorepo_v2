import { test, expect } from '@playwright/test';

test.describe('Tunnel Transfert', () => {
  test('devrait aller jusqu\'à la page de paiement Stripe pour un transfert', async ({ page }) => {
    // 1. Accéder au tunnel
    await page.goto('http://localhost:4321/tunnels/transfert');
    
    // Attendre que la page se charge
    await page.waitForSelector('form#tunnel-form');

    // ÉTAPE 1 : Sélection du Trajet
    // On sélectionne la première option disponible (index 1 car index 0 est "disabled selected")
    const routeSelect = page.locator('select[name="routeSelect"]');
    await routeSelect.selectOption({ index: 1 });

    page.on('dialog', dialog => dialog.accept());

    // Les champs adresses apparaissent (Etape 1)
    await page.locator('input[name="pickupAddress"]').fill('1 Rue de Rivoli, 75001 Paris, Terminal 2E, Vol AF123');
    await page.locator('input[name="dropoffAddress"]').fill('1 Rue de Rivoli, 75001 Paris');

    // Cliquer sur Continuer
    await page.locator('button:has-text("Continuer")').click();

    // ÉTAPE 2 : Sélection du Véhicule
    // Attendre que l'étape 2 s'affiche
    await expect(page.locator('.step-container[data-step="2"]')).not.toHaveClass(/hidden/);
    
    // Cliquer sur le premier véhicule
    await page.locator('input[name="vehicle"]').first().click({ force: true });
    
    // Continuer
    await page.locator('button:has-text("Continuer")').click();

    // ÉTAPE 3 : Date et Heure
    await expect(page.locator('.step-container[data-step="3"]')).not.toHaveClass(/hidden/);
    
    // Remplir les champs
    await page.locator('input[name="date"]').fill('2026-12-01');
    await page.locator('input[name="time"]').fill('14:30');
    
    // Continuer
    await page.locator('button:has-text("Continuer")').click();

    // ÉTAPE 4 : Coordonnées Client (était l'étape 5)
    await expect(page.locator('.step-container[data-step="4"]')).not.toHaveClass(/hidden/);
    
    await page.locator('input[name="firstName"]').fill('Test');
    await page.locator('input[name="lastName"]').fill('Client');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="phone"]').fill('+33612345678');

    // Valider et aller sur Stripe
    // Le bouton doit être "Finaliser la réservation"
    await expect(page.locator('button:has-text("Finaliser la réservation")')).toBeVisible();
    
    // On intercepte la redirection vers Stripe
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('checkout.stripe.com')),
      page.locator('button:has-text("Finaliser la réservation")').click()
    ]);
    
    expect(request.url()).toContain('checkout.stripe.com');
    console.log("✅ Redirection Stripe interceptée avec succès ! URL : ", request.url());
  });
});
