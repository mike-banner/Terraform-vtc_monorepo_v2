import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import ws from 'ws';

dotenv.config({ path: '.env' });

let supabase: any;

test.beforeAll(() => {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
      transport: ws
    }
  });
});

test.describe.serial('Backoffice E2E Flow', () => {
  let testEmail = `e2e-test-${Date.now()}@vtc.com`;
  let testPassword = 'Password123!';
  let userId: string;
  let tenantId: string;

  test.afterAll(async () => {
    // Nettoyage API Injection / Suppression
    if (userId) {
      console.log(`🧹 Nettoyage de l'utilisateur ${userId}`);
      
      // Delete Tenant
      if (tenantId) {
        await supabase.from('tenants').delete().eq('id', tenantId);
      }
      
      // Delete Driver/Onboarding records implicitly deleted by Cascade if configured, 
      // otherwise explicit deletion
      await supabase.from('onboarding').delete().eq('profile_id', userId);
      
      // Delete Auth user
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('Processus Complet: Inscription -> Approbation -> Réservation', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds for this long E2E test

    // 1. Navigation vers l'inscription
    await page.goto('/signup');
    
    // 2. Remplir le formulaire principal
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button#next-btn');
    
    // Etape 2: Profil
    await page.fill('input[name="first_name"]', 'Play');
    await page.fill('input[name="last_name"]', 'Wright');
    await page.fill('input[name="phone_number"]', `612${Date.now().toString().slice(-6)}`);
    await page.click('button#next-btn');
    
    // Etape 3: Entreprise
    const testSiret = `123${Date.now().toString().slice(-11)}`;
    await page.fill('input[name="company_name"]', 'E2E VTC Corp');
    await page.fill('input[name="primary_domain"]', `e2e-domain-${Date.now()}`);
    await page.fill('input[name="siret"]', testSiret);
    await page.fill('input[name="vtc_license_number"]', `12${Date.now().toString().slice(-10)}`);
    
    // Soumission Finale
    await page.click('button#final-btn');
    
    // Attente de la redirection sur /waiting-approval
    await page.waitForURL('**/waiting-approval');
    await expect(page).toHaveURL(/.*\/waiting-approval/);

    await page.waitForTimeout(3000); // Wait for the DB insertion

    // Retrieve userId from Supabase for admin operations later
    let retries = 5;
    while (retries > 0) {
      const { data: userList } = await supabase.auth.admin.listUsers();
      const user = userList?.users?.find((u: any) => u.email === testEmail);
      if (user) {
        userId = user.id;
        break;
      }
      await page.waitForTimeout(1000);
      retries--;
    }

    expect(userId).toBeDefined();

    // Simuler l'action d'un Admin: Approbation de l'onboarding
    const { error: obError } = await supabase.from('onboarding').update({ status: 'approved' }).eq('profile_id', userId);
    expect(obError).toBeNull();
    
    // Créer un tenant manuellement pour le test (simule le trigger/API backend)
    const { data: tenant, error: tError } = await supabase.from('tenants').insert({
      name: 'VTC E2E Corp',
      siret: `123${Date.now().toString().slice(-11)}`,
      primary_domain: `e2e-domain-${Date.now()}`
    }).select().single();
    if (tError) console.error("TENANT ERROR:", tError);
    expect(tError).toBeNull();
    
    tenantId = tenant.id;

    // Mettre à jour le profil avec le tenant_id
    const { error: pError } = await supabase.from('profiles').update({
      tenant_id: tenant.id,
      tenant_role: 'owner'
    }).eq('id', userId);
    expect(pError).toBeNull();
    
    // Injecter un chauffeur
    const { data: driver, error: dError } = await supabase.from('drivers').insert({
      tenant_id: tenant.id,
      user_id: userId,
      first_name: 'John',
      last_name: 'Doe',
      phone: '0612345678',
      license_number: '123456789'
    }).select().single();
    expect(dError).toBeNull();
    
    // Injecter un véhicule
    const { error: vError } = await supabase.from('vehicles').insert({
      tenant_id: tenant.id,
      driver_id: driver.id,
      brand: 'Tesla',
      model: 'Model S',
      plate_number: 'AB-123-CD',
      category: 'berline'
    });
    expect(vError).toBeNull();
    
    // On simule un rechargement / navigation vers l'app après approbation
    await page.goto('/app/bookings');

    // Print URL to debug where we landed
    console.log("URL AFTER GOTO:", page.url());
    
    // L'utilisateur approuvé devrait accéder au dashboard (ou au setup)
    // await page.waitForURL('**/app*');

    // Scénario 3 : Réservation manuelle
    // Naviguer vers les réservations
    await page.goto('/app/bookings');
    
    // Ouvrir le modal Nouvelle Course
    await page.click('#open-new-booking');
    
    // Remplir le formulaire
    await page.fill('input[name="client_name"]', 'John Doe E2E');
    await page.fill('input[name="client_email"]', 'johndoe@e2e.com');
    await page.fill('input[name="pickup"]', 'Gare de Lyon, Paris');
    
    // Le input dropoff a un id particulier
    await page.fill('#dropoff-input', 'Aéroport Charles de Gaulle');
    
    // Date: demain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 16);
    await page.fill('input[name="pickup_time"]', tomorrowIso);
    
    // Prix estimé
    await page.fill('input[name="manual_total"]', '85.50');
    
    const invalidFields = await page.evaluate(() => {
      const form = document.getElementById('new-booking-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        const invalids = [];
        for (const el of form.elements) {
          if (!(el as HTMLInputElement).validity.valid) {
            invalids.push((el as HTMLInputElement).name || (el as HTMLInputElement).id);
          }
        }
        return invalids;
      }
      return [];
    });
    console.log("INVALID FIELDS:", invalidFields);
    
    // Soumettre et intercepter la requête
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/tenant/create-booking') && res.request().method() === 'POST'),
      page.click('#new-booking-form button[type="submit"]')
    ]);
    
    console.log("API BOOKING STATUS:", response.status());
    if (!response.ok()) {
      console.log("API BOOKING ERROR:", await response.text());
    }
    
    // Attendre que la course apparaisse dans la liste
    // On cherche le texte 'John Doe E2E' ou on attend une requete reseau
    await expect(page.locator('text=John Doe E2E >> visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test.skip('Tentative accès non autorisé (RLS)', async () => {
    // Tenter de lire les courses sans JWT via l'API publique
    const { data, error } = await createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!)
      .from('bookings').select('*');
    
    // Le RLS doit renvoyer un tableau vide ou une erreur si pas connecté
    expect(data?.length).toBe(0);
  });
});
