import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import './e2e-env';
import { purgeTenantBookings } from './helpers/seed';

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
  const testEmail = `e2e-test-${Date.now()}@vtc.com`;
  const testPassword = 'Password123!';
  let userId: string;
  let tenantId: string;

  test.afterAll(async () => {
    // Nettoyage API Injection / Suppression
    if (userId) {
      console.log(`🧹 Nettoyage de l'utilisateur ${userId}`);
      
      // Les FK bookings -> tenants ne sont pas en cascade : sans ce DELETE préalable,
      // celui du tenant échouait en silence et laissait un tenant orphelin en base.
      if (tenantId) {
        purgeTenantBookings(tenantId); // courses terminées : ledger et trigger anti-suppression
        const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
        if (error) console.error('Nettoyage tenant en échec :', error.message);
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
    
    // 2. Étape 1 : compte
    await page.getByLabel('Email professionnel').fill(testEmail);
    await page.getByLabel('Mot de passe').fill(testPassword);
    const next = page.getByRole('button', { name: 'Suivant' });
    await next.click();

    // Étape 2 : profil
    await page.getByLabel('Prénom').fill('Play');
    await page.getByLabel('Nom', { exact: true }).fill('Wright');
    await page.getByLabel('Téléphone').fill(`612${Date.now().toString().slice(-6)}`);
    await next.click();

    // Étape 3 : entreprise
    const testSiret = `123${Date.now().toString().slice(-11)}`;
    await page.getByLabel("Nom de l'entreprise").fill('E2E VTC Corp');
    await page.getByLabel('Domaine web').fill(`e2e-domain-${Date.now()}`);
    await page.getByLabel('SIRET').fill(testSiret);
    await page.getByLabel('Carte VTC').fill(`12${Date.now().toString().slice(-10)}`);

    // Soumission finale
    await page.getByRole('button', { name: 'Finaliser' }).click();

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

    // Approbation par la vraie fonction, pas par des INSERT à la main : c'est ce qui
    // a laissé approve_onboarding_tx cassée de mai à septembre sans qu'un test le voie.
    // Le chemin UI (superadmin) est couvert par onboarding-approval.spec.ts.
    const { data: onboarding } = await supabase.from('onboarding').select('id').eq('profile_id', userId).single();
    const { error: approveError } = await supabase.rpc('approve_onboarding_tx', { onboarding_uuid: onboarding.id });
    expect(approveError).toBeNull();

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single();
    tenantId = profile.tenant_id;
    expect(tenantId).toBeTruthy();

    // Driver titulaire créé par l'approbation
    const { data: driver, error: dError } = await supabase.from('drivers').select('id').eq('user_id', userId).single();
    expect(dError).toBeNull();

    // Le véhicule vient de app/setup.astro, pas de l'approbation : on l'injecte.
    // Injecter un véhicule
    const { error: vError } = await supabase.from('vehicles').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      brand: 'Tesla',
      model: 'Model S',
      plate_number: 'AB-123-CD',
      category: 'berline'
    });
    expect(vError).toBeNull();
    
    // Prérequis de configuration (la porte d'entrée de /app renvoie sinon vers /app/setup) : identité légale validée,
    // un véhicule actif (ci-dessus) et un tarif actif.
    const { error: tError } = await supabase.from('tenants').update({ setup_completed: true }).eq('id', tenantId);
    expect(tError).toBeNull();
    const { error: rError } = await supabase.from('pricing_rules').insert({
      tenant_id: tenantId, service_category: 'berline', base_price: 10, price_per_km: 2, price_per_hour: 60, minimum_fare: 30, active: true,
    });
    expect(rError).toBeNull();

    // L'approbation s'est faite côté serveur : le jeton de la session d'inscription est périmé, on se reconnecte.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Adresse email').fill(testEmail);
    await page.getByLabel('Mot de passe', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Connexion', exact: true }).click();
    await page.waitForURL('**/app/**');

    // Scénario 3 : réservation manuelle (formulaire React)
    await page.goto('/app/bookings');
    await page.getByRole('button', { name: 'Nouvelle course' }).click();
    const form = page.getByRole('dialog', { name: 'Nouvelle course' });
    await form.getByLabel('Nom du client').fill('John Doe E2E');
    await form.getByLabel('E-mail du client').fill('johndoe@e2e.com');
    await form.getByLabel('Adresse de départ').fill('Gare de Lyon, Paris');
    await form.getByLabel("Adresse d'arrivée").fill('Aéroport Charles de Gaulle');

    // Dans 10 minutes (heure locale du navigateur) : « En route » est disponible dès 15 minutes avant le départ.
    const d = new Date(Date.now() + 10 * 60_000);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await form.getByLabel('Date et heure de prise en charge').fill(local);
    await form.getByLabel('Montant TTC (€)').fill('85.50');
    await form.getByRole('button', { name: 'Confirmer la réservation' }).click();

    // La fiche de la nouvelle course s'ouvre.
    const fiche = page.getByRole('dialog', { name: /^Course #/ });
    await expect(fiche).toContainText('John Doe E2E', { timeout: 10000 });
    await expect(fiche).toContainText(/85,50\s€/);

    // --- Cycle de vie & notation ---
    // La réservation créée manuellement est déjà « non démarrée » : pas de prise en main, « En route » puis « Terminer ».
    await fiche.getByRole('button', { name: 'En route', exact: true }).click();
    await fiche.getByRole('button', { name: 'Terminer', exact: true }).click();

    // Course terminée : le QR de notation apparaît.
    await expect(fiche).toContainText('Faire noter la course', { timeout: 10000 });
    await expect(fiche.locator('svg').last()).toBeVisible();
    // NB : on ne navigue pas sur /rate (page publique couverte ailleurs).
    // Le tarif (création, modification) est couvert par backoffice-pricing.spec.ts.
  });

  test.skip('Tentative accès non autorisé (RLS)', async () => {
    // Tenter de lire les courses sans JWT via l'API publique
    const { data } = await createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!)
      .from('bookings').select('*');
    
    // Le RLS doit renvoyer un tableau vide ou une erreur si pas connecté
    expect(data?.length).toBe(0);
  });
});
